use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorDomain {
    Player,
    Lyrics,
    Translation,
    Annotation,
    Settings,
    Storage,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub domain: ErrorDomain,
    pub retryable: bool,
    pub technical_message: String,
}

impl AppError {
    pub fn new(
        code: impl Into<String>,
        domain: ErrorDomain,
        retryable: bool,
        technical_message: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            domain,
            retryable,
            technical_message: technical_message.into(),
        }
    }

    pub fn ai(domain: ErrorDomain, provider: &str, technical_message: String) -> Self {
        if technical_message.starts_with("CLI_") {
            let code = technical_message.split(':').next().unwrap_or("CLI_PROCESS_FAILED");
            return Self::new(code, domain, !matches!(code, "CLI_NOT_FOUND" | "CLI_UNSUPPORTED" | "CLI_AUTH_REQUIRED" | "CLI_MODEL_UNAVAILABLE"), technical_message.clone());
        }

        let normalized = technical_message.to_ascii_lowercase();
        if matches!(provider, "ollama" | "lmstudio") {
            return Self::local_ai(domain, technical_message);
        }
        let is_gemini = provider.eq_ignore_ascii_case("gemini");
        if normalized.contains("system credential store") {
            return Self::settings(technical_message);
        }

        if contains_any(
            &normalized,
            &[
                "api key is missing",
                "api key missing",
                "gemini api key is missing",
            ],
        ) {
            return Self::new("AI_API_KEY_MISSING", domain, false, technical_message);
        }
        if is_gemini && normalized.contains("api key was reported as leaked") {
            return Self::new("AI_API_KEY_COMPROMISED", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "api key not valid",
                "invalid api key",
                "invalid_api_key",
                "unauthenticated",
                "401 unauthorized",
            ],
        ) {
            return Self::new("AI_API_KEY_INVALID", domain, false, technical_message);
        }
        if is_gemini
            && contains_any(&normalized, &["free tier", "country", "region"])
            && contains_any(&normalized, &["not available", "not supported"])
        {
            return Self::new("AI_REGION_UNAVAILABLE", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "enable billing",
                "billing required",
                "paid plan",
                "spend limit",
            ],
        ) {
            return Self::new("AI_BILLING_REQUIRED", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "prohibited_content",
                "prohibited content",
                "prompt blocked",
                "blocked for safety",
                "finishreason: safety",
                "finish_reason: safety",
                "recitation",
                "blocklist",
                "spii",
                "image_safety",
            ],
        ) {
            return Self::new("AI_CONTENT_BLOCKED", domain, false, technical_message);
        }
        if contains_any(&normalized, &["model", "models/"])
            && contains_any(
                &normalized,
                &["404", "not_found", "not found", "unsupported"],
            )
        {
            return Self::new("AI_MODEL_NOT_FOUND", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "input token",
                "context length",
                "context window",
                "too many tokens",
                "request too large",
            ],
        ) && contains_any(&normalized, &["exceed", "maximum", "too large", "limit"])
        {
            return Self::new("AI_INPUT_TOO_LARGE", domain, false, technical_message);
        }
        if (normalized.contains("quota") || normalized.contains("resource_exhausted"))
            && contains_any(
                &normalized,
                &[
                    "per day",
                    "daily",
                    "rpd",
                    "spend",
                    "billing",
                    "current quota",
                    "not enough quota",
                    "not have enough quota",
                    "insufficient quota",
                    "insufficient_quota",
                    "quota exhausted",
                    "quota has been exhausted",
                    "quota exceeded",
                ],
            )
        {
            return Self::new("AI_QUOTA_EXHAUSTED", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &["429", "resource_exhausted", "too_many_requests"],
        ) {
            return Self::new("AI_RATE_LIMITED", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "504",
                "deadline_exceeded",
                "deadline exceeded",
                "timed out",
                "timeout",
            ],
        ) {
            return Self::new("AI_REQUEST_TIMEOUT", domain, true, technical_message);
        }
        if contains_any(&normalized, &["499", "cancelled", "canceled"]) {
            return Self::new("AI_REQUEST_CANCELLED", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "error sending request",
                "connection refused",
                "network is unreachable",
                "dns error",
                "connect error",
                "tcp connect",
            ],
        ) {
            return Self::new("NETWORK_UNAVAILABLE", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &["503", "unavailable", "overloaded", "capacity"],
        ) {
            return Self::new("AI_SERVICE_UNAVAILABLE", domain, true, technical_message);
        }
        if contains_any(&normalized, &["500", "internal", "unknown server error"]) {
            return Self::new("AI_SERVICE_ERROR", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "interaction incomplete",
                "status=incomplete",
                "budget_exceeded",
                "missing ids",
                "did not return translations",
                "did not include translations",
            ],
        ) {
            return Self::new("AI_RESPONSE_INCOMPLETE", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "json parse failed",
                "response parse failed",
                "response text missing",
                "response id validation failed",
                "schema validation",
                "malformed response",
            ],
        ) {
            return Self::new("AI_RESPONSE_INVALID", domain, true, technical_message);
        }
        if contains_any(&normalized, &["404", "not_found", "not found"]) {
            return Self::new("AI_RESOURCE_NOT_FOUND", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &["403", "permission_denied", "permission denied"],
        ) {
            return Self::new("AI_PERMISSION_DENIED", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "400",
                "invalid_argument",
                "failed_precondition",
                "malformed",
            ],
        ) {
            return Self::new("AI_REQUEST_INVALID", domain, false, technical_message);
        }

        Self::new("AI_REQUEST_FAILED", domain, true, technical_message)
    }

    pub fn player(technical_message: String) -> Self {
        let normalized = technical_message.to_ascii_lowercase();
        if contains_any(
            &normalized,
            &[
                "not authorized",
                "not permitted",
                "apple events",
                "automation permission",
                "access denied",
                "-1743",
            ],
        ) {
            return Self::new(
                "PLAYER_PERMISSION_DENIED",
                ErrorDomain::Player,
                false,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "no supported player",
                "no controllable player",
                "isn't running",
                "is not running",
            ],
        ) {
            return Self::new(
                "PLAYER_NOT_RUNNING",
                ErrorDomain::Player,
                true,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &["parse player response", "player response parse"],
        ) {
            return Self::new(
                "PLAYER_RESPONSE_INVALID",
                ErrorDomain::Player,
                true,
                technical_message,
            );
        }

        Self::new(
            "PLAYER_UNAVAILABLE",
            ErrorDomain::Player,
            true,
            technical_message,
        )
    }

    pub fn lyrics(technical_message: String) -> Self {
        let normalized = technical_message.to_ascii_lowercase();
        if normalized.contains("system credential store") {
            return Self::settings(technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "media-user-token is missing",
                "sp_dc is missing",
                "lyrics credential is missing",
                "authentication is missing",
            ],
        ) {
            return Self::new(
                "LYRICS_AUTH_REQUIRED",
                ErrorDomain::Lyrics,
                false,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &["401", "403", "unauthorized", "forbidden", "token expired"],
        ) {
            return Self::new(
                "LYRICS_AUTH_EXPIRED",
                ErrorDomain::Lyrics,
                false,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "error sending request",
                "connection refused",
                "network is unreachable",
                "dns error",
                "connect error",
            ],
        ) {
            return Self::new(
                "NETWORK_UNAVAILABLE",
                ErrorDomain::Lyrics,
                true,
                technical_message,
            );
        }
        if contains_any(&normalized, &["timed out", "timeout", "deadline exceeded"]) {
            return Self::new(
                "LYRICS_REQUEST_TIMEOUT",
                ErrorDomain::Lyrics,
                true,
                technical_message,
            );
        }
        if contains_any(&normalized, &["catalog song not found", "lyrics not found"]) {
            return Self::new(
                "LYRICS_NOT_FOUND",
                ErrorDomain::Lyrics,
                false,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "parse failed",
                "decode failed",
                "response parse",
                "ttml parse",
            ],
        ) {
            return Self::new(
                "LYRICS_RESPONSE_INVALID",
                ErrorDomain::Lyrics,
                true,
                technical_message,
            );
        }
        if normalized.contains("429") {
            return Self::new(
                "LYRICS_RATE_LIMITED",
                ErrorDomain::Lyrics,
                true,
                technical_message,
            );
        }
        if contains_any(&normalized, &["500", "502", "503", "504"]) {
            return Self::new(
                "LYRICS_SERVICE_UNAVAILABLE",
                ErrorDomain::Lyrics,
                true,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &["track_id is required", "title and artist are required"],
        ) {
            return Self::new(
                "LYRICS_REQUEST_INVALID",
                ErrorDomain::Lyrics,
                false,
                technical_message,
            );
        }

        Self::new(
            "LYRICS_FETCH_FAILED",
            ErrorDomain::Lyrics,
            true,
            technical_message,
        )
    }

    pub fn settings(technical_message: String) -> Self {
        let normalized = technical_message.to_ascii_lowercase();
        if contains_any(
            &normalized,
            &["secret value is empty", "unsupported secret kind"],
        ) {
            return Self::new(
                "SETTINGS_INVALID_VALUE",
                ErrorDomain::Settings,
                false,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "clear keychain",
                "clear keychain secret",
                "clear credential manager",
                "clear credential manager secret",
                "clear system credential store",
            ],
        ) {
            return Self::new(
                "SETTINGS_CLEAR_FAILED",
                ErrorDomain::Settings,
                true,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "save keychain",
                "save keychain secret",
                "encode keychain",
                "save credential manager",
                "save credential manager secret",
                "encode credential manager",
                "save system credential store",
                "encode system credential store",
            ],
        ) {
            return Self::new(
                "SETTINGS_SAVE_FAILED",
                ErrorDomain::Settings,
                true,
                technical_message,
            );
        }
        if contains_any(
            &normalized,
            &[
                "read keychain",
                "open keychain",
                "decode keychain",
                "secret store version",
                "read credential manager",
                "open credential manager",
                "decode credential manager",
                "read system credential store",
                "open system credential store",
                "decode system credential store",
            ],
        ) {
            return Self::new(
                "SETTINGS_LOAD_FAILED",
                ErrorDomain::Settings,
                true,
                technical_message,
            );
        }

        Self::new(
            "SETTINGS_OPERATION_FAILED",
            ErrorDomain::Settings,
            true,
            technical_message,
        )
    }

    pub fn storage(technical_message: String) -> Self {
        let normalized = technical_message.to_ascii_lowercase();
        if contains_any(
            &normalized,
            &[
                "write cache",
                "create cache directory",
                "create temporary cache file",
                "replace cache file",
                "serialize cache",
                "save cache",
            ],
        ) {
            return Self::new(
                "CACHE_WRITE_FAILED",
                ErrorDomain::Storage,
                true,
                technical_message,
            );
        }
        if contains_any(&normalized, &["read cache", "load cache"]) {
            return Self::new(
                "CACHE_READ_FAILED",
                ErrorDomain::Storage,
                true,
                technical_message,
            );
        }

        Self::new(
            "CACHE_OPERATION_FAILED",
            ErrorDomain::Storage,
            true,
            technical_message,
        )
    }

    pub fn local_ai(domain: ErrorDomain, technical_message: String) -> Self {
        let normalized = technical_message.to_ascii_lowercase();
        if normalized.contains("system credential store") {
            return Self::settings(technical_message);
        }
        if normalized.contains("base url must start") {
            return Self::new("LOCAL_AI_URL_INVALID", domain, false, technical_message);
        }
        if contains_any(&normalized, &["model was not listed", "model not found", "unknown model"])
            || (normalized.contains("model") && normalized.contains("not found"))
        {
            return Self::new("LOCAL_AI_MODEL_NOT_FOUND", domain, false, technical_message);
        }
        if contains_any(
            &normalized,
            &[
                "connection failed",
                "connection refused",
                "error sending request",
                "network is unreachable",
            ],
        ) {
            return Self::new("LOCAL_AI_UNREACHABLE", domain, true, technical_message);
        }
        if contains_any(
            &normalized,
            &["parse failed", "response read failed", "response text missing", "response id validation failed"],
        ) {
            return Self::new("LOCAL_AI_RESPONSE_INVALID", domain, true, technical_message);
        }

        Self::new(
            "LOCAL_AI_CONNECTION_FAILED",
            domain,
            true,
            technical_message,
        )
    }

    pub fn task(domain: ErrorDomain, operation: &str, technical_message: String) -> Self {
        Self::new(
            "APP_TASK_FAILED",
            domain,
            true,
            format!("{operation}: {technical_message}"),
        )
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_local_requests_keep_actionable_local_errors() {
        for provider in ["ollama", "lmstudio"] {
            for domain in [ErrorDomain::Translation, ErrorDomain::Annotation] {
                for (message, code) in [
                    ("Local AI base URL must start with http:// or https://", "LOCAL_AI_URL_INVALID"),
                    ("request failed: error sending request", "LOCAL_AI_UNREACHABLE"),
                    ("model 'example' not found", "LOCAL_AI_MODEL_NOT_FOUND"),
                    ("AI JSON parse failed", "LOCAL_AI_RESPONSE_INVALID"),
                ] {
                    let error = AppError::ai(domain, provider, message.into());
                    assert_eq!(error.code, code);
                    assert_eq!(error.domain, domain);
                }
            }
        }
    }

    #[test]
    fn credential_store_failures_are_never_reported_as_missing_keys() {
        let message = "Failed to read system credential store secret: access denied";
        for provider in ["gemini", "openai", "claude", "openai_compatible", "ollama", "lmstudio"] {
            let error = AppError::ai(ErrorDomain::Translation, provider, message.into());
            assert_eq!(error.code, "SETTINGS_LOAD_FAILED");
            assert_eq!(error.domain, ErrorDomain::Settings);
        }
        assert_eq!(AppError::lyrics(message.into()).code, "SETTINGS_LOAD_FAILED");
    }

    #[test]
    fn classifies_gemini_leaked_key_as_replacement_required() {
        let error = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            r#"Gemini interaction request failed: 403 Forbidden {"error":{"code":403,"message":"Your API key was reported as leaked. Please use another API key.","status":"PERMISSION_DENIED"}}"#.to_string(),
        );

        assert_eq!(error.code, "AI_API_KEY_COMPROMISED");
        assert!(!error.retryable);
    }

    #[test]
    fn classifies_gemini_rate_limit_as_retryable() {
        let error = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            r#"Gemini interaction request failed: 429 Too Many Requests {"error":{"code":429,"message":"Rate limit exceeded","status":"RESOURCE_EXHAUSTED"}}"#.to_string(),
        );

        assert_eq!(error.code, "AI_RATE_LIMITED");
        assert!(error.retryable);
    }

    #[test]
    fn classifies_gemini_daily_quota_as_non_retryable_now() {
        let error = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            r#"429 RESOURCE_EXHAUSTED: You exceeded your current quota for requests per day"#
                .to_string(),
        );

        assert_eq!(error.code, "AI_QUOTA_EXHAUSTED");
        assert!(!error.retryable);
    }

    #[test]
    fn classifies_gemini_stream_quota_before_outer_incomplete_status() {
        let error = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini interaction incomplete: status=in_progress; stream_error=Gemini interaction stream error [too_many_requests]: You do not have enough quota to make this request.; missing ids: 0, 1, 2, 3, 4, 5, 6, 7, ... (+27)".to_string(),
        );

        assert_eq!(error.code, "AI_QUOTA_EXHAUSTED");
        assert!(!error.retryable);
    }

    #[test]
    fn classifies_gemini_too_many_requests_without_quota_as_rate_limit() {
        let error = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini interaction stream error [too_many_requests]: Please retry shortly."
                .to_string(),
        );

        assert_eq!(error.code, "AI_RATE_LIMITED");
        assert!(error.retryable);
    }

    #[test]
    fn classifies_gemini_key_and_permission_failures() {
        let missing = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini API key is missing. Save it in SongDocent Settings.".to_string(),
        );
        let invalid = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            r#"400 INVALID_ARGUMENT: API key not valid. Please pass a valid API key."#.to_string(),
        );
        let permission = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            r#"403 PERMISSION_DENIED: The API key does not have the required permissions."#
                .to_string(),
        );

        assert_eq!(missing.code, "AI_API_KEY_MISSING");
        assert_eq!(invalid.code, "AI_API_KEY_INVALID");
        assert_eq!(permission.code, "AI_PERMISSION_DENIED");
        assert!(!missing.retryable && !invalid.retryable && !permission.retryable);
    }

    #[test]
    fn classifies_gemini_region_and_billing_preconditions() {
        let region = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "400 FAILED_PRECONDITION: Gemini API free tier is not available in your country."
                .to_string(),
        );
        let billing = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "400 FAILED_PRECONDITION: Please enable billing on your project.".to_string(),
        );

        assert_eq!(region.code, "AI_REGION_UNAVAILABLE");
        assert_eq!(billing.code, "AI_BILLING_REQUIRED");
    }

    #[test]
    fn classifies_gemini_request_and_model_problems() {
        let invalid = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "400 INVALID_ARGUMENT: Request body is malformed.".to_string(),
        );
        let too_large = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "400 INVALID_ARGUMENT: Input token count exceeds the maximum context length."
                .to_string(),
        );
        let model = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "404 NOT_FOUND: models/gemini-old is not found for API version v1beta.".to_string(),
        );

        assert_eq!(invalid.code, "AI_REQUEST_INVALID");
        assert_eq!(too_large.code, "AI_INPUT_TOO_LARGE");
        assert_eq!(model.code, "AI_MODEL_NOT_FOUND");
    }

    #[test]
    fn classifies_gemini_transient_backend_failures() {
        for (message, expected_code) in [
            (
                "500 INTERNAL: An unexpected error occurred",
                "AI_SERVICE_ERROR",
            ),
            (
                "503 UNAVAILABLE: The service is overloaded",
                "AI_SERVICE_UNAVAILABLE",
            ),
            ("504 DEADLINE_EXCEEDED", "AI_REQUEST_TIMEOUT"),
            ("499 CANCELLED", "AI_REQUEST_CANCELLED"),
        ] {
            let error = AppError::ai(ErrorDomain::Translation, "gemini", message.to_string());
            assert_eq!(error.code, expected_code);
            assert!(error.retryable);
        }
    }

    #[test]
    fn classifies_gemini_transport_failures() {
        let offline = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini interaction request failed: error sending request: connection refused"
                .to_string(),
        );
        let timeout = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini interaction stream read failed: operation timed out".to_string(),
        );

        assert_eq!(offline.code, "NETWORK_UNAVAILABLE");
        assert_eq!(timeout.code, "AI_REQUEST_TIMEOUT");
    }

    #[test]
    fn classifies_gemini_content_blocks() {
        for message in [
            "Gemini stream error: prohibited_content",
            "Prompt blocked for SAFETY",
            "Generation stopped: RECITATION",
            "Generation stopped: SPII",
        ] {
            let error = AppError::ai(ErrorDomain::Annotation, "gemini", message.to_string());
            assert_eq!(error.code, "AI_CONTENT_BLOCKED");
            assert!(!error.retryable);
        }
    }

    #[test]
    fn classifies_gemini_incomplete_and_invalid_responses() {
        let incomplete = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "Gemini interaction incomplete: status=budget_exceeded; missing ids: 3".to_string(),
        );
        let invalid = AppError::ai(
            ErrorDomain::Translation,
            "gemini",
            "AI JSON parse failed: expected value at line 1".to_string(),
        );

        assert_eq!(incomplete.code, "AI_RESPONSE_INCOMPLETE");
        assert_eq!(invalid.code, "AI_RESPONSE_INVALID");
        assert!(incomplete.retryable && invalid.retryable);
    }

    #[test]
    fn serializes_for_tauri_with_camel_case_fields() {
        let value = serde_json::to_value(AppError::new(
            "AI_SERVICE_UNAVAILABLE",
            ErrorDomain::Translation,
            true,
            "503 UNAVAILABLE",
        ))
        .unwrap();

        assert_eq!(value["technicalMessage"], "503 UNAVAILABLE");
        assert_eq!(value["domain"], "translation");
    }

    #[test]
    fn classifies_player_failures_by_recovery() {
        let permission =
            AppError::player("Not authorized to send Apple events to Spotify. (-1743)".to_string());
        let missing = AppError::player("No supported player is running".to_string());
        let invalid = AppError::player(
            "Failed to parse player response: expected value. Raw: ???".to_string(),
        );

        assert_eq!(permission.code, "PLAYER_PERMISSION_DENIED");
        assert_eq!(missing.code, "PLAYER_NOT_RUNNING");
        assert_eq!(invalid.code, "PLAYER_RESPONSE_INVALID");
    }

    #[test]
    fn classifies_lyrics_auth_network_and_response_failures() {
        let missing = AppError::lyrics(
            "Apple Music media-user-token is missing. Save it in Settings.".to_string(),
        );
        let expired =
            AppError::lyrics("Spotify lyrics request failed: 401 Unauthorized".to_string());
        let offline = AppError::lyrics(
            "Spotify lyrics request failed: error sending request: connection refused".to_string(),
        );
        let invalid =
            AppError::lyrics("Apple Music TTML parse failed: unexpected end of file".to_string());

        assert_eq!(missing.code, "LYRICS_AUTH_REQUIRED");
        assert_eq!(expired.code, "LYRICS_AUTH_EXPIRED");
        assert_eq!(offline.code, "NETWORK_UNAVAILABLE");
        assert_eq!(invalid.code, "LYRICS_RESPONSE_INVALID");
    }

    #[test]
    fn classifies_settings_and_cache_storage_failures() {
        let keychain = AppError::settings(
            "Failed to save Keychain secrets: interaction not allowed".to_string(),
        );
        let cache = AppError::storage(
            "Failed to write cache file /tmp/cache.json: permission denied".to_string(),
        );

        assert_eq!(keychain.code, "SETTINGS_SAVE_FAILED");
        assert_eq!(cache.code, "CACHE_WRITE_FAILED");
    }

    #[test]
    fn classifies_windows_media_and_credential_store_failures() {
        let media = AppError::player(
            "Windows media session access denied: 0x80070005".to_string(),
        );
        let load = AppError::settings(
            "Failed to read Credential Manager secret: access denied".to_string(),
        );
        let save = AppError::settings(
            "Failed to save Credential Manager secrets: access denied".to_string(),
        );
        let clear = AppError::settings(
            "Failed to clear Credential Manager secret: access denied".to_string(),
        );
        let missing = AppError::lyrics(
            "Spotify SP_DC is missing. Save it in Windows Credential Manager.".to_string(),
        );
        let generic_load = AppError::settings(
            "Failed to read system credential store secret: access denied".to_string(),
        );
        let generic_save = AppError::settings(
            "Failed to save system credential store secrets: access denied".to_string(),
        );
        let generic_clear = AppError::settings(
            "Failed to clear system credential store secret: access denied".to_string(),
        );

        assert_eq!(media.code, "PLAYER_PERMISSION_DENIED");
        assert_eq!(load.code, "SETTINGS_LOAD_FAILED");
        assert_eq!(save.code, "SETTINGS_SAVE_FAILED");
        assert_eq!(clear.code, "SETTINGS_CLEAR_FAILED");
        assert_eq!(missing.code, "LYRICS_AUTH_REQUIRED");
        assert_eq!(generic_load.code, "SETTINGS_LOAD_FAILED");
        assert_eq!(generic_save.code, "SETTINGS_SAVE_FAILED");
        assert_eq!(generic_clear.code, "SETTINGS_CLEAR_FAILED");
    }

    #[test]
    fn classifies_local_ai_connection_and_model_failures() {
        let offline = AppError::local_ai(
            ErrorDomain::Settings,
            "Ollama connection failed: connection refused".to_string(),
        );
        let model = AppError::local_ai(
            ErrorDomain::Settings,
            "Ollama connected, but model was not listed".to_string(),
        );

        assert_eq!(offline.code, "LOCAL_AI_UNREACHABLE");
        assert_eq!(model.code, "LOCAL_AI_MODEL_NOT_FOUND");
    }
}
