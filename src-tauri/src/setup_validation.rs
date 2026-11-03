use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

use crate::app_error::{AppError, ErrorDomain};
use crate::lyrics::{self, ProviderRequestError, SpotifyTokenParseError};

const VALIDATION_TIMEOUT_SECONDS: u64 = 12;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CredentialValidationStatus {
    Valid,
    Invalid,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialValidationResult {
    status: CredentialValidationStatus,
    code: String,
}

impl CredentialValidationResult {
    pub(crate) fn valid() -> Self {
        Self {
            status: CredentialValidationStatus::Valid,
            code: "ok".to_string(),
        }
    }

    pub(crate) fn invalid(code: &str) -> Self {
        Self {
            status: CredentialValidationStatus::Invalid,
            code: code.to_string(),
        }
    }

    pub(crate) fn unavailable(code: &str) -> Self {
        Self {
            status: CredentialValidationStatus::Unavailable,
            code: code.to_string(),
        }
    }

    pub(crate) fn status(&self) -> CredentialValidationStatus {
        self.status
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CredentialKind {
    SpotifySpDc,
    AppleMusicMediaUserToken,
    GeminiApiKey,
    OpenAiApiKey,
    ClaudeApiKey,
}

impl CredentialKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "spotify_sp_dc" => Some(Self::SpotifySpDc),
            "apple_music_media_user_token" => Some(Self::AppleMusicMediaUserToken),
            "gemini_api_key" => Some(Self::GeminiApiKey),
            "openai_api_key" => Some(Self::OpenAiApiKey),
            "claude_api_key" => Some(Self::ClaudeApiKey),
            _ => None,
        }
    }
}

#[tauri::command]
pub async fn validate_setup_credential(
    kind: String,
    value: String,
) -> Result<CredentialValidationResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || validate_credential_value(&kind, &value))
        .await
        .map_err(|_| {
            AppError::new(
                "SETTINGS_CREDENTIAL_VALIDATION_FAILED",
                ErrorDomain::Settings,
                true,
                "Credential validation task failed",
            )
        })?
}

pub(crate) fn validate_credential_value(
    kind: &str,
    value: &str,
) -> Result<CredentialValidationResult, AppError> {
    let kind = parse_credential_kind(kind)?;
    Ok(empty_input_result(value).unwrap_or_else(|| validate_credential(kind, value.trim())))
}

fn parse_credential_kind(value: &str) -> Result<CredentialKind, AppError> {
    CredentialKind::parse(value)
        .ok_or_else(|| AppError::settings("unsupported secret kind".to_string()))
}

fn empty_input_result(value: &str) -> Option<CredentialValidationResult> {
    value
        .trim()
        .is_empty()
        .then(|| CredentialValidationResult::invalid("empty"))
}

fn validate_credential(kind: CredentialKind, value: &str) -> CredentialValidationResult {
    match kind {
        CredentialKind::SpotifySpDc => validate_spotify_sp_dc(value),
        CredentialKind::AppleMusicMediaUserToken => validate_apple_music_token(value),
        CredentialKind::GeminiApiKey => validate_gemini_api_key(value),
        CredentialKind::OpenAiApiKey => validate_openai_api_key(value),
        CredentialKind::ClaudeApiKey => validate_claude_api_key(value),
    }
}

fn validate_spotify_sp_dc(sp_dc: &str) -> CredentialValidationResult {
    let (status, data) = match lyrics::request_spotify_token_response(sp_dc) {
        Ok(response) => response,
        Err(error) => return map_provider_request_error(error, CredentialKind::SpotifySpDc),
    };
    let status_result = classify_http_status(CredentialKind::SpotifySpDc, status);
    if status_result.status != CredentialValidationStatus::Valid {
        return status_result;
    }
    let Some(data) = data else {
        return CredentialValidationResult::unavailable("service");
    };
    match lyrics::parse_spotify_token_response(&data) {
        Ok(_) => CredentialValidationResult::valid(),
        Err(SpotifyTokenParseError::Anonymous) => {
            CredentialValidationResult::invalid("unauthorized")
        }
        Err(SpotifyTokenParseError::InvalidShape) => {
            CredentialValidationResult::unavailable("service")
        }
    }
}

fn validate_apple_music_token(media_user_token: &str) -> CredentialValidationResult {
    let client = match lyrics::apple_music_client() {
        Ok(client) => client,
        Err(error) => return map_apple_bootstrap_error(error),
    };
    let response = match retry_apple_storefront_with_fresh_developer_token(
        || lyrics::get_apple_music_access_token(&client).map_err(AppleValidationError::Bootstrap),
        |access_token| {
            lyrics::request_apple_music_storefront(&client, access_token, media_user_token)
                .map_err(AppleValidationError::Storefront)
        },
        |response| response.status().as_u16(),
        lyrics::invalidate_cached_apple_music_access_token,
    ) {
        Ok(response) => response,
        Err(AppleValidationError::Bootstrap(error)) => return map_apple_bootstrap_error(error),
        Err(AppleValidationError::Storefront(error)) => {
            return map_provider_request_error(error, CredentialKind::AppleMusicMediaUserToken)
        }
    };
    let status_result = classify_http_status(
        CredentialKind::AppleMusicMediaUserToken,
        response.status().as_u16(),
    );
    if status_result.status != CredentialValidationStatus::Valid {
        return status_result;
    }
    let data = match response.json::<Value>() {
        Ok(data) => data,
        Err(_) => return CredentialValidationResult::unavailable("service"),
    };
    if lyrics::has_valid_apple_music_storefront(&data) {
        CredentialValidationResult::valid()
    } else {
        CredentialValidationResult::unavailable("service")
    }
}

fn validate_gemini_api_key(api_key: &str) -> CredentialValidationResult {
    validate_http_request(
        CredentialKind::GeminiApiKey,
        |client| {
            client
                .get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1")
                .header("x-goog-api-key", api_key)
                .send()
        },
        classify_gemini_response,
    )
}

fn validate_openai_api_key(api_key: &str) -> CredentialValidationResult {
    validate_http_request(
        CredentialKind::OpenAiApiKey,
        |client| {
            client
                .get("https://api.openai.com/v1/models")
                .bearer_auth(api_key)
                .send()
        },
        classify_openai_response,
    )
}

fn validate_claude_api_key(api_key: &str) -> CredentialValidationResult {
    validate_http_request(
        CredentialKind::ClaudeApiKey,
        |client| {
            client
                .get("https://api.anthropic.com/v1/models?limit=1")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .send()
        },
        classify_claude_response,
    )
}

fn classify_claude_response(status: u16, body: &str) -> CredentialValidationResult {
    classify_model_list_response(CredentialKind::ClaudeApiKey, status, body, "data")
}

fn validate_http_request(
    kind: CredentialKind,
    send: impl FnOnce(&reqwest::blocking::Client) -> Result<reqwest::blocking::Response, reqwest::Error>,
    classify_response: fn(u16, &str) -> CredentialValidationResult,
) -> CredentialValidationResult {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(VALIDATION_TIMEOUT_SECONDS))
        .build()
    {
        Ok(client) => client,
        Err(error) if error.is_builder() => {
            return CredentialValidationResult::invalid("invalid_input")
        }
        Err(_) => return CredentialValidationResult::unavailable("network"),
    };
    match send(&client) {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_result = classify_http_status(kind, status);
            if status_result.status != CredentialValidationStatus::Valid {
                return status_result;
            }
            match response.text() {
                Ok(body) => classify_response(status, &body),
                Err(_) => CredentialValidationResult::unavailable("service"),
            }
        }
        Err(error) if error.is_builder() => CredentialValidationResult::invalid("invalid_input"),
        Err(error) if error.is_timeout() => CredentialValidationResult::unavailable("timeout"),
        Err(_) => CredentialValidationResult::unavailable("network"),
    }
}

fn classify_gemini_response(status: u16, body: &str) -> CredentialValidationResult {
    classify_model_list_response(CredentialKind::GeminiApiKey, status, body, "models")
}

fn classify_openai_response(status: u16, body: &str) -> CredentialValidationResult {
    classify_model_list_response(CredentialKind::OpenAiApiKey, status, body, "data")
}

fn classify_model_list_response(
    kind: CredentialKind,
    status: u16,
    body: &str,
    array_key: &str,
) -> CredentialValidationResult {
    let status_result = classify_http_status(kind, status);
    if status_result.status != CredentialValidationStatus::Valid {
        return status_result;
    }
    let valid_shape = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|data| {
            data.get(array_key)
                .and_then(Value::as_array)
                .map(|items| !items.is_empty())
        })
        .unwrap_or(false);
    if valid_shape {
        CredentialValidationResult::valid()
    } else {
        CredentialValidationResult::unavailable("service")
    }
}

fn classify_http_status(kind: CredentialKind, status: u16) -> CredentialValidationResult {
    match status {
        200..=299 => CredentialValidationResult::valid(),
        408 => CredentialValidationResult::unavailable("timeout"),
        429 => CredentialValidationResult::unavailable("rate_limited"),
        400..=499 if is_definite_credential_rejection(kind, status) => {
            CredentialValidationResult::invalid("unauthorized")
        }
        _ => CredentialValidationResult::unavailable("service"),
    }
}

fn is_definite_credential_rejection(kind: CredentialKind, status: u16) -> bool {
    match kind {
        CredentialKind::SpotifySpDc | CredentialKind::GeminiApiKey => {
            matches!(status, 400 | 401 | 403)
        }
        CredentialKind::AppleMusicMediaUserToken
        | CredentialKind::OpenAiApiKey
        | CredentialKind::ClaudeApiKey => {
            matches!(status, 401 | 403)
        }
    }
}

fn map_provider_request_error(
    error: ProviderRequestError,
    kind: CredentialKind,
) -> CredentialValidationResult {
    match error {
        ProviderRequestError::Timeout => CredentialValidationResult::unavailable("timeout"),
        ProviderRequestError::Network => CredentialValidationResult::unavailable("network"),
        ProviderRequestError::Http(status) => classify_http_status(kind, status),
        ProviderRequestError::InvalidResponse => CredentialValidationResult::unavailable("service"),
        ProviderRequestError::InvalidInput => CredentialValidationResult::invalid("invalid_input"),
    }
}

fn map_apple_bootstrap_error(error: ProviderRequestError) -> CredentialValidationResult {
    match error {
        ProviderRequestError::Timeout => CredentialValidationResult::unavailable("timeout"),
        ProviderRequestError::Network => CredentialValidationResult::unavailable("network"),
        ProviderRequestError::Http(408) => CredentialValidationResult::unavailable("timeout"),
        ProviderRequestError::Http(429) => CredentialValidationResult::unavailable("rate_limited"),
        ProviderRequestError::Http(_)
        | ProviderRequestError::InvalidResponse
        | ProviderRequestError::InvalidInput => CredentialValidationResult::unavailable("service"),
    }
}

enum AppleValidationError {
    Bootstrap(ProviderRequestError),
    Storefront(ProviderRequestError),
}

fn retry_apple_storefront_with_fresh_developer_token<T, E>(
    fetch_token: impl FnMut() -> Result<String, E>,
    request_storefront: impl FnMut(&str) -> Result<T, E>,
    status: impl Fn(&T) -> u16,
    invalidate_token: impl FnMut(),
) -> Result<T, E> {
    lyrics::retry_apple_music_with_fresh_developer_token(fetch_token, request_storefront, status, invalidate_token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_error::ErrorDomain;
    use serde_json::Value;

    #[test]
    fn classifies_provider_specific_http_statuses() {
        for kind in [
            CredentialKind::SpotifySpDc,
            CredentialKind::AppleMusicMediaUserToken,
            CredentialKind::GeminiApiKey,
            CredentialKind::OpenAiApiKey,
        ] {
            assert_eq!(
                classify_http_status(kind, 200),
                CredentialValidationResult::valid()
            );
            assert_eq!(
                classify_http_status(kind, 408),
                CredentialValidationResult::unavailable("timeout")
            );
            assert_eq!(
                classify_http_status(kind, 429),
                CredentialValidationResult::unavailable("rate_limited")
            );
            assert_eq!(
                classify_http_status(kind, 503),
                CredentialValidationResult::unavailable("service")
            );
        }

        for status in [400, 401, 403] {
            assert_eq!(
                classify_http_status(CredentialKind::SpotifySpDc, status),
                CredentialValidationResult::invalid("unauthorized")
            );
            assert_eq!(
                classify_http_status(CredentialKind::GeminiApiKey, status),
                CredentialValidationResult::invalid("unauthorized")
            );
        }
        for status in [401, 403] {
            assert_eq!(
                classify_http_status(CredentialKind::AppleMusicMediaUserToken, status),
                CredentialValidationResult::invalid("unauthorized")
            );
            assert_eq!(
                classify_http_status(CredentialKind::OpenAiApiKey, status),
                CredentialValidationResult::invalid("unauthorized")
            );
        }
        for status in [400, 404, 409, 422] {
            assert_eq!(
                classify_http_status(CredentialKind::AppleMusicMediaUserToken, status),
                CredentialValidationResult::unavailable("service")
            );
            assert_eq!(
                classify_http_status(CredentialKind::OpenAiApiKey, status),
                CredentialValidationResult::unavailable("service")
            );
        }
        for status in [404, 409, 422] {
            assert_eq!(
                classify_http_status(CredentialKind::SpotifySpDc, status),
                CredentialValidationResult::unavailable("service")
            );
            assert_eq!(
                classify_http_status(CredentialKind::GeminiApiKey, status),
                CredentialValidationResult::unavailable("service")
            );
        }
    }

    #[test]
    fn gemini_success_requires_a_non_empty_models_array() {
        assert_eq!(
            classify_gemini_response(200, r#"{"models":[{"name":"models/test"}]}"#),
            CredentialValidationResult::valid()
        );
        for (status, body) in [
            (204, ""),
            (200, ""),
            (200, "not-json"),
            (200, r#"{"other":[]}"#),
            (200, r#"{"models":[]}"#),
        ] {
            assert_eq!(
                classify_gemini_response(status, body),
                CredentialValidationResult::unavailable("service")
            );
        }
    }

    #[test]
    fn openai_success_requires_a_non_empty_data_array() {
        assert_eq!(
            classify_openai_response(200, r#"{"data":[{"id":"model-test"}]}"#),
            CredentialValidationResult::valid()
        );
        for (status, body) in [
            (204, ""),
            (200, ""),
            (200, "not-json"),
            (200, r#"{"other":[]}"#),
            (200, r#"{"data":[]}"#),
        ] {
            assert_eq!(
                classify_openai_response(status, body),
                CredentialValidationResult::unavailable("service")
            );
        }
    }

    #[test]
    fn model_response_parsers_classify_status_before_body_shape() {
        for classify in [
            classify_gemini_response as fn(u16, &str) -> CredentialValidationResult,
            classify_openai_response,
        ] {
            assert_eq!(
                classify(401, "not-json"),
                CredentialValidationResult::invalid("unauthorized")
            );
            assert_eq!(
                classify(408, "not-json"),
                CredentialValidationResult::unavailable("timeout")
            );
            assert_eq!(
                classify(429, "not-json"),
                CredentialValidationResult::unavailable("rate_limited")
            );
            assert_eq!(
                classify(503, "not-json"),
                CredentialValidationResult::unavailable("service")
            );
        }
        assert_eq!(
            classify_gemini_response(400, "not-json"),
            CredentialValidationResult::invalid("unauthorized")
        );
        assert_eq!(
            classify_openai_response(400, "not-json"),
            CredentialValidationResult::unavailable("service")
        );
    }

    #[test]
    fn invalid_input_errors_are_invalid_without_exposing_input() {
        assert_eq!(
            map_provider_request_error(
                ProviderRequestError::InvalidInput,
                CredentialKind::SpotifySpDc,
            ),
            CredentialValidationResult::invalid("invalid_input")
        );
    }

    #[test]
    fn apple_developer_token_auth_failure_invalidates_and_retries_once() {
        let fetch_count = std::cell::Cell::new(0);
        let invalidation_count = std::cell::Cell::new(0);
        let requested_tokens = std::cell::RefCell::new(Vec::new());

        let response = retry_apple_storefront_with_fresh_developer_token(
            || {
                let count = fetch_count.get() + 1;
                fetch_count.set(count);
                Ok::<_, ProviderRequestError>(format!("developer-token-{count}"))
            },
            |token| {
                requested_tokens.borrow_mut().push(token.to_string());
                Ok::<_, ProviderRequestError>(if token.ends_with('1') { 401 } else { 200 })
            },
            |status| *status,
            || invalidation_count.set(invalidation_count.get() + 1),
        )
        .expect("retry should return the second response");

        assert_eq!(response, 200);
        assert_eq!(fetch_count.get(), 2);
        assert_eq!(invalidation_count.get(), 1);
        assert_eq!(
            requested_tokens.into_inner(),
            vec!["developer-token-1", "developer-token-2"]
        );
    }

    #[test]
    fn apple_developer_token_retry_happens_at_most_once() {
        let fetch_count = std::cell::Cell::new(0);
        let invalidation_count = std::cell::Cell::new(0);
        let request_count = std::cell::Cell::new(0);

        let response = retry_apple_storefront_with_fresh_developer_token(
            || {
                fetch_count.set(fetch_count.get() + 1);
                Ok::<_, ProviderRequestError>("developer-token".to_string())
            },
            |_| {
                request_count.set(request_count.get() + 1);
                Ok::<_, ProviderRequestError>(403)
            },
            |status| *status,
            || invalidation_count.set(invalidation_count.get() + 1),
        )
        .expect("second auth response should be returned");

        assert_eq!(response, 403);
        assert_eq!(fetch_count.get(), 2);
        assert_eq!(request_count.get(), 2);
        assert_eq!(invalidation_count.get(), 1);
    }

    #[test]
    fn empty_trimmed_input_is_invalid_without_a_probe() {
        assert_eq!(
            empty_input_result(" \n\t "),
            Some(CredentialValidationResult::invalid("empty"))
        );
        assert_eq!(empty_input_result("not-empty"), None);
    }

    #[test]
    fn parses_only_supported_credential_kinds() {
        assert_eq!(
            CredentialKind::parse("spotify_sp_dc"),
            Some(CredentialKind::SpotifySpDc)
        );
        assert_eq!(
            CredentialKind::parse("apple_music_media_user_token"),
            Some(CredentialKind::AppleMusicMediaUserToken)
        );
        assert_eq!(
            CredentialKind::parse("gemini_api_key"),
            Some(CredentialKind::GeminiApiKey)
        );
        assert_eq!(
            CredentialKind::parse("openai_api_key"),
            Some(CredentialKind::OpenAiApiKey)
        );
        assert_eq!(
            CredentialKind::parse("claude_api_key"),
            Some(CredentialKind::ClaudeApiKey)
        );
        assert_eq!(CredentialKind::parse("Spotify_sp_dc"), None);
        assert_eq!(CredentialKind::parse(" spotify_sp_dc "), None);
        assert_eq!(CredentialKind::parse("unsupported"), None);
    }

    #[test]
    fn unsupported_kind_is_a_settings_error() {
        let error = parse_credential_kind("unsupported").expect_err("kind must be rejected");

        assert_eq!(error.domain, ErrorDomain::Settings);
        assert_eq!(error.code, "SETTINGS_INVALID_VALUE");
    }

    #[test]
    fn serialized_result_contains_only_status_and_code() {
        let submitted_secret = "sample-super-secret-key";
        let raw_body = r#"{"error":"upstream-secret-body"}"#;
        let result = map_provider_request_error(
            ProviderRequestError::InvalidResponse,
            CredentialKind::GeminiApiKey,
        );
        let serialized = serde_json::to_value(result).expect("result should serialize");

        assert_eq!(serialized.as_object().map(|object| object.len()), Some(2));
        assert_eq!(serialized.get("status"), Some(&Value::from("unavailable")));
        assert_eq!(serialized.get("code"), Some(&Value::from("service")));
        let serialized = serialized.to_string();
        assert!(!serialized.contains(submitted_secret));
        assert!(!serialized.contains(raw_body));
        assert!(!serialized.contains("upstream-secret-body"));
    }

    #[test]
    fn helper_error_mapping_never_exposes_supplied_text() {
        let supplied = "Bearer secret-token and raw upstream response";
        let result = map_provider_request_error(
            ProviderRequestError::InvalidResponse,
            CredentialKind::GeminiApiKey,
        );

        assert_eq!(result, CredentialValidationResult::unavailable("service"));
        assert!(!result.code.contains(supplied));
    }
}
