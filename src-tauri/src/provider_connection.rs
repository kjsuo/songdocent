use std::{
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{
    webview::Cookie, AppHandle, Manager, State, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

use crate::app_error::AppError;
use crate::secrets;
use crate::setup_validation::{CredentialValidationResult, CredentialValidationStatus};

const CAPTURE_POLL_INTERVAL: Duration = Duration::from_millis(750);
const CAPTURE_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const MAX_COOKIE_READ_FAILURES: u8 = 3;

const SPOTIFY_HOSTS: &[&str] = &[
    "open.spotify.com",
    "accounts.spotify.com",
    "login5.spotify.com",
];
const SPOTIFY_COOKIE_URLS: &[&str] = &["https://open.spotify.com/", "https://spotify.com/"];
const APPLE_MUSIC_HOSTS: &[&str] = &[
    "music.apple.com",
    "idmsa.apple.com",
    "appleid.apple.com",
    "account.apple.com",
];
const APPLE_MUSIC_COOKIE_URLS: &[&str] = &["https://music.apple.com/"];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Spotify,
    AppleMusic,
}

impl Provider {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "spotify" => Some(Self::Spotify),
            "apple_music" => Some(Self::AppleMusic),
            _ => None,
        }
    }

    fn policy(self) -> ProviderPolicy {
        match self {
            Self::Spotify => ProviderPolicy {
                start_url: "https://accounts.spotify.com/en/login?continue=https%3A%2F%2Fopen.spotify.com%2F",
                cookie_urls: SPOTIFY_COOKIE_URLS,
                cookie_name: "sp_dc",
                allowed_hosts: SPOTIFY_HOSTS,
                allow_recaptcha: true,
            },
            Self::AppleMusic => ProviderPolicy {
                start_url: "https://music.apple.com/",
                cookie_urls: APPLE_MUSIC_COOKIE_URLS,
                cookie_name: "media-user-token",
                allowed_hosts: APPLE_MUSIC_HOSTS,
                allow_recaptcha: false,
            },
        }
    }

    fn title(self, language: &str) -> String {
        let name = match self {
            Self::Spotify => "Spotify",
            Self::AppleMusic => "Apple Music",
        };
        match language {
            "ko" => format!("{name} 연결 — SongDocent"),
            "ja" => format!("{name}に接続 — SongDocent"),
            "es" => format!("Conectar {name} — SongDocent"),
            "fr" => format!("Connecter {name} — SongDocent"),
            "de" => format!("{name} verbinden — SongDocent"),
            "pt-BR" => format!("Conectar {name} — SongDocent"),
            "zh-CN" => format!("连接 {name} — SongDocent"),
            _ => format!("Connect {name} — SongDocent"),
        }
    }

    fn secret_kind(self) -> &'static str {
        match self {
            Self::Spotify => "spotify_sp_dc",
            Self::AppleMusic => "apple_music_media_user_token",
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct ProviderPolicy {
    start_url: &'static str,
    cookie_urls: &'static [&'static str],
    cookie_name: &'static str,
    allowed_hosts: &'static [&'static str],
    allow_recaptcha: bool,
}

impl ProviderPolicy {
    fn allows_url(self, url: &Url) -> bool {
        if url.scheme() == "about" && url.path() == "blank" {
            return true;
        }
        if url.scheme() != "https" {
            return false;
        }
        let Some(host) = url.host_str() else {
            return false;
        };
        if self
            .allowed_hosts
            .iter()
            .any(|allowed| host.eq_ignore_ascii_case(allowed))
        {
            return true;
        }

        self.allow_recaptcha && is_recaptcha_support_url(host, url.path())
    }
}

fn is_recaptcha_support_url(host: &str, path: &str) -> bool {
    if !path.starts_with("/recaptcha/") {
        return false;
    }
    matches!(
        host.to_ascii_lowercase().as_str(),
        "www.google.com" | "www.gstatic.com" | "www.recaptcha.net" | "recaptcha.net"
    )
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionPhase {
    Opening,
    WaitingForLogin,
    Validating,
    Connected,
    Cancelled,
    TimedOut,
    RecoverableError,
    TerminalError,
}

impl ConnectionPhase {
    fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Connected
                | Self::Cancelled
                | Self::TimedOut
                | Self::RecoverableError
                | Self::TerminalError
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    connection_id: u64,
    provider: Provider,
    phase: ConnectionPhase,
    code: Option<String>,
}

impl ConnectionStatus {
    fn opening(connection_id: u64, provider: Provider) -> Self {
        Self {
            connection_id,
            provider,
            phase: ConnectionPhase::Opening,
            code: None,
        }
    }

    #[cfg(test)]
    fn waiting(connection_id: u64, provider: Provider) -> Self {
        Self {
            connection_id,
            provider,
            phase: ConnectionPhase::WaitingForLogin,
            code: None,
        }
    }
}

#[derive(Debug, Default)]
struct ConnectionRegistry {
    next_id: u64,
    current: Option<ConnectionStatus>,
}

#[derive(Clone, Debug, Default)]
pub struct ProviderConnectionService {
    registry: Arc<Mutex<ConnectionRegistry>>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ConnectionFailure {
    phase: ConnectionPhase,
    code: &'static str,
}

impl ConnectionFailure {
    fn recoverable(code: &'static str) -> Self {
        Self {
            phase: ConnectionPhase::RecoverableError,
            code,
        }
    }

    fn terminal(code: &'static str) -> Self {
        Self {
            phase: ConnectionPhase::TerminalError,
            code,
        }
    }
}

fn validate_then_save(
    value: &str,
    validate: impl FnOnce(&str) -> Result<CredentialValidationResult, AppError>,
    save: impl FnOnce(&str) -> Result<(), String>,
) -> Result<(), ConnectionFailure> {
    let validation = validate(value)
        .map_err(|_| ConnectionFailure::recoverable("credential_validation_unavailable"))?;
    match validation.status() {
        CredentialValidationStatus::Valid => {
            save(value).map_err(|_| ConnectionFailure::terminal("credential_store_denied"))
        }
        CredentialValidationStatus::Invalid => {
            Err(ConnectionFailure::recoverable("credential_invalid"))
        }
        CredentialValidationStatus::Unavailable => Err(ConnectionFailure::recoverable(
            "credential_validation_unavailable",
        )),
    }
}

fn matching_cookie_value(policy: ProviderPolicy, cookies: &[Cookie<'_>]) -> Option<String> {
    cookies
        .iter()
        .find(|cookie| cookie.name() == policy.cookie_name)
        .map(|cookie| cookie.value().trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

impl ConnectionRegistry {
    fn begin(&mut self, provider: Provider) -> Result<ConnectionStatus, &'static str> {
        if self
            .current
            .as_ref()
            .is_some_and(|status| !status.phase.is_terminal())
        {
            return Err("connection_in_progress");
        }
        self.next_id = self.next_id.saturating_add(1).max(1);
        let status = ConnectionStatus::opening(self.next_id, provider);
        self.current = Some(status.clone());
        Ok(status)
    }

    fn status(&self, connection_id: u64) -> Option<ConnectionStatus> {
        self.current
            .as_ref()
            .filter(|status| status.connection_id == connection_id)
            .cloned()
    }

    fn transition(
        &mut self,
        connection_id: u64,
        phase: ConnectionPhase,
        code: Option<&str>,
    ) -> bool {
        let Some(status) = self
            .current
            .as_mut()
            .filter(|status| status.connection_id == connection_id)
        else {
            return false;
        };
        if status.phase.is_terminal() {
            return false;
        }
        status.phase = phase;
        status.code = code.map(str::to_string);
        true
    }

    fn cancel(&mut self, connection_id: u64) -> bool {
        self.transition(
            connection_id,
            ConnectionPhase::Cancelled,
            Some("connection_cancelled"),
        )
    }
}

impl ProviderConnectionService {
    fn save_if_validating(
        &self,
        connection_id: u64,
        save: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        // Cancellation and committing the credential must have one ordering.
        // Hold the registry lock through the write and terminal transition.
        let mut registry = self.registry.lock()
            .map_err(|_| "connection_runtime_error".to_string())?;
        if !registry.status(connection_id)
            .is_some_and(|status| status.phase == ConnectionPhase::Validating)
        {
            return Err("connection_cancelled".to_string());
        }
        save()?;
        registry.transition(connection_id, ConnectionPhase::Connected, None);
        Ok(())
    }

    fn begin(&self, provider: Provider) -> Result<ConnectionStatus, &'static str> {
        self.registry
            .lock()
            .map_err(|_| "connection_runtime_error")?
            .begin(provider)
    }

    fn status(&self, connection_id: u64) -> Result<Option<ConnectionStatus>, &'static str> {
        self.registry
            .lock()
            .map_err(|_| "connection_runtime_error")
            .map(|registry| registry.status(connection_id))
    }

    fn transition(&self, connection_id: u64, phase: ConnectionPhase, code: Option<&str>) -> bool {
        self.registry
            .lock()
            .map(|mut registry| registry.transition(connection_id, phase, code))
            .unwrap_or(false)
    }

    fn cancel(&self, connection_id: u64) -> bool {
        self.registry
            .lock()
            .map(|mut registry| registry.cancel(connection_id))
            .unwrap_or(false)
    }

    fn is_active(&self, connection_id: u64) -> bool {
        self.status(connection_id)
            .ok()
            .flatten()
            .is_some_and(|status| !status.phase.is_terminal())
    }
}

fn connection_error(code: &'static str, retryable: bool) -> AppError {
    AppError::new(
        code.to_ascii_uppercase(),
        crate::app_error::ErrorDomain::Settings,
        retryable,
        "Provider connection failed",
    )
}

fn window_label(connection_id: u64) -> String {
    format!("provider-connection-{connection_id}")
}

// WebView2 window creation deadlocks inside synchronous commands on Windows.
#[tauri::command]
pub async fn start_provider_connection(
    app: AppHandle,
    service: State<'_, ProviderConnectionService>,
    provider: String,
    language: Option<String>,
) -> Result<ConnectionStatus, AppError> {
    let provider = Provider::parse(&provider)
        .ok_or_else(|| connection_error("unsupported_provider", false))?;
    let initial = service
        .begin(provider)
        .map_err(|code| connection_error(code, true))?;
    let connection_id = initial.connection_id;
    let policy = provider.policy();
    let start_url = Url::parse(policy.start_url).map_err(|_| {
        service.transition(
            connection_id,
            ConnectionPhase::TerminalError,
            Some("connection_runtime_error"),
        );
        connection_error("connection_runtime_error", true)
    })?;
    let cookie_urls = policy
        .cookie_urls
        .iter()
        .map(|url| Url::parse(url))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| {
            service.transition(
                connection_id,
                ConnectionPhase::TerminalError,
                Some("connection_runtime_error"),
            );
            connection_error("connection_runtime_error", true)
        })?;

    let navigation_policy = policy;
    let window = WebviewWindowBuilder::new(
        &app,
        window_label(connection_id),
        WebviewUrl::External(start_url.clone()),
    )
    .title(provider.title(language.as_deref().unwrap_or("en")))
    .inner_size(960.0, 720.0)
    .center()
    .incognito(true)
    .on_navigation(move |url| navigation_policy.allows_url(url))
    .build()
    .map_err(|_| {
        service.transition(
            connection_id,
            ConnectionPhase::TerminalError,
            Some("connection_runtime_error"),
        );
        connection_error("connection_runtime_error", true)
    })?;

    let _ = window.set_content_protected(true);
    let close_service = service.inner().clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            close_service.cancel(connection_id);
        }
    });

    service.transition(connection_id, ConnectionPhase::WaitingForLogin, None);

    let worker_service = service.inner().clone();
    let worker_window = window.clone();
    tauri::async_runtime::spawn_blocking(move || {
        capture_connection(
            worker_service,
            worker_window,
            connection_id,
            provider,
            policy,
            cookie_urls,
        );
    });

    service
        .status(connection_id)
        .map_err(|code| connection_error(code, true))?
        .ok_or_else(|| connection_error("connection_runtime_error", true))
}

#[tauri::command]
pub fn get_provider_connection_status(
    service: State<'_, ProviderConnectionService>,
    connection_id: u64,
) -> Result<ConnectionStatus, AppError> {
    service
        .status(connection_id)
        .map_err(|code| connection_error(code, true))?
        .ok_or_else(|| connection_error("connection_not_found", false))
}

#[tauri::command]
pub fn cancel_provider_connection(
    app: AppHandle,
    service: State<'_, ProviderConnectionService>,
    connection_id: u64,
) -> Result<ConnectionStatus, AppError> {
    if !service.cancel(connection_id) {
        return Err(connection_error("connection_not_found", false));
    }
    if let Some(window) = app.get_webview_window(&window_label(connection_id)) {
        let _ = window.destroy();
    }
    service
        .status(connection_id)
        .map_err(|code| connection_error(code, true))?
        .ok_or_else(|| connection_error("connection_not_found", false))
}

fn capture_connection(
    service: ProviderConnectionService,
    window: WebviewWindow,
    connection_id: u64,
    provider: Provider,
    policy: ProviderPolicy,
    cookie_urls: Vec<Url>,
) {
    let started = Instant::now();
    let mut read_failures = 0_u8;

    while service.is_active(connection_id) {
        if started.elapsed() >= CAPTURE_TIMEOUT {
            service.transition(
                connection_id,
                ConnectionPhase::TimedOut,
                Some("connection_timed_out"),
            );
            let _ = window.destroy();
            return;
        }

        let mut read_any_cookie_url = false;
        let mut found_value: Option<String> = None;

        for cookie_url in &cookie_urls {
            match window.cookies_for_url(cookie_url.clone()) {
                Ok(cookies) => {
                    read_any_cookie_url = true;
                    if let Some(value) = matching_cookie_value(policy, &cookies) {
                        found_value = Some(value);
                        break;
                    }
                }
                Err(_) => {}
            }
        }

        if read_any_cookie_url {
            read_failures = 0;
            if let Some(value) = found_value {
                if !service.transition(connection_id, ConnectionPhase::Validating, None) {
                    return;
                }
                let result = validate_then_save(
                    &value,
                    |candidate| {
                        crate::setup_validation::validate_credential_value(
                            provider.secret_kind(),
                            candidate,
                        )
                    },
                    |candidate| service.save_if_validating(connection_id, || {
                        secrets::save_secret_value(provider.secret_kind(), candidate)
                    }),
                );
                if let Err(failure) = result {
                    service.transition(connection_id, failure.phase, Some(failure.code));
                }
                let _ = window.destroy();
                return;
            }
        } else {
            read_failures = read_failures.saturating_add(1);
            if read_failures >= MAX_COOKIE_READ_FAILURES {
                service.transition(
                    connection_id,
                    ConnectionPhase::RecoverableError,
                    Some("connection_runtime_error"),
                );
                let _ = window.destroy();
                return;
            }
        }
        thread::sleep(CAPTURE_POLL_INTERVAL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup_validation::CredentialValidationResult;
    use std::cell::Cell;

    #[test]
    fn connection_titles_follow_the_selected_language() {
        for (language, spotify, apple) in [
            ("en", "Connect Spotify — SongDocent", "Connect Apple Music — SongDocent"),
            ("ko", "Spotify 연결 — SongDocent", "Apple Music 연결 — SongDocent"),
            ("ja", "Spotifyに接続 — SongDocent", "Apple Musicに接続 — SongDocent"),
            ("es", "Conectar Spotify — SongDocent", "Conectar Apple Music — SongDocent"),
            ("fr", "Connecter Spotify — SongDocent", "Connecter Apple Music — SongDocent"),
            ("de", "Spotify verbinden — SongDocent", "Apple Music verbinden — SongDocent"),
            ("pt-BR", "Conectar Spotify — SongDocent", "Conectar Apple Music — SongDocent"),
            ("zh-CN", "连接 Spotify — SongDocent", "连接 Apple Music — SongDocent"),
        ] {
            assert_eq!(Provider::Spotify.title(language), spotify);
            assert_eq!(Provider::AppleMusic.title(language), apple);
        }
        assert_eq!(Provider::Spotify.title("unsupported"), Provider::Spotify.title("en"));
    }

    #[test]
    fn provider_policy_uses_exact_cookie_targets() {
        let spotify = Provider::parse("spotify").unwrap().policy();
        assert_eq!(
            spotify.start_url,
            "https://accounts.spotify.com/en/login?continue=https%3A%2F%2Fopen.spotify.com%2F",
        );
        assert_eq!(
            spotify.cookie_urls,
            &["https://open.spotify.com/", "https://spotify.com/"],
        );
        assert_eq!(spotify.cookie_name, "sp_dc");

        let apple = Provider::parse("apple_music").unwrap().policy();
        assert_eq!(apple.start_url, "https://music.apple.com/");
        assert_eq!(apple.cookie_urls, &["https://music.apple.com/"]);
        assert_eq!(apple.cookie_name, "media-user-token");
    }

    #[test]
    fn provider_parser_rejects_unknown_values() {
        assert_eq!(Provider::parse("Spotify"), None);
        assert_eq!(Provider::parse("unknown"), None);
    }

    #[test]
    fn navigation_rejects_lookalike_domains_and_insecure_urls() {
        let policy = Provider::Spotify.policy();
        assert!(policy.allows_url(&"about:blank".parse().unwrap()));
        assert!(policy.allows_url(&"https://accounts.spotify.com/login".parse().unwrap()));
        assert!(!policy.allows_url(
            &"https://accounts.spotify.com.evil.test/login"
                .parse()
                .unwrap()
        ));
        assert!(!policy.allows_url(&"http://accounts.spotify.com/login".parse().unwrap()));
    }

    #[test]
    fn spotify_navigation_allows_only_recaptcha_support_paths() {
        let policy = Provider::Spotify.policy();
        assert!(policy.allows_url(
            &"https://www.google.com/recaptcha/api2/anchor"
                .parse()
                .unwrap()
        ));
        assert!(policy.allows_url(
            &"https://www.gstatic.com/recaptcha/releases/test/recaptcha__en.js"
                .parse()
                .unwrap()
        ));
        assert!(policy.allows_url(
            &"https://www.recaptcha.net/recaptcha/api2/bframe"
                .parse()
                .unwrap()
        ));
        assert!(!policy.allows_url(&"https://www.google.com/search?q=spotify".parse().unwrap()));
        assert!(!Provider::AppleMusic.policy().allows_url(
            &"https://www.google.com/recaptcha/api2/anchor"
                .parse()
                .unwrap()
        ));
    }

    #[test]
    fn apple_navigation_allows_only_reviewed_hosts() {
        let policy = Provider::AppleMusic.policy();
        assert!(policy.allows_url(
            &"https://idmsa.apple.com/appleauth/auth/signin"
                .parse()
                .unwrap()
        ));
        assert!(!policy.allows_url(&"https://evilapple.com/login".parse().unwrap()));
    }

    #[test]
    fn registry_allows_only_one_active_connection() {
        let mut registry = ConnectionRegistry::default();
        let first = registry.begin(Provider::Spotify).unwrap();
        assert_eq!(
            registry.begin(Provider::AppleMusic),
            Err("connection_in_progress")
        );
        assert_eq!(registry.status(first.connection_id), Some(first));
    }

    #[test]
    fn stale_connection_cannot_replace_current_state() {
        let mut registry = ConnectionRegistry::default();
        let first = registry.begin(Provider::Spotify).unwrap();
        assert!(registry.cancel(first.connection_id));
        let second = registry.begin(Provider::AppleMusic).unwrap();
        assert!(!registry.transition(first.connection_id, ConnectionPhase::Connected, None));
        assert!(registry.transition(second.connection_id, ConnectionPhase::Validating, None));
    }

    #[test]
    fn serialized_status_contains_no_secret_field() {
        let status = ConnectionStatus::waiting(7, Provider::Spotify);
        let json = serde_json::to_string(&status).unwrap();
        assert!(!json.contains("cookie"));
        assert!(!json.contains("secret"));
        assert!(!json.contains("token"));
        assert_eq!(
            json,
            r#"{"connectionId":7,"provider":"spotify","phase":"waiting_for_login","code":null}"#
        );
    }

    #[test]
    fn capture_saves_only_after_valid_validation() {
        let saved = Cell::new(false);
        let result = validate_then_save(
            "credential",
            |_| Ok(CredentialValidationResult::valid()),
            |_| {
                saved.set(true);
                Ok(())
            },
        );

        assert_eq!(result, Ok(()));
        assert!(saved.get());
    }

    #[test]
    fn invalid_capture_preserves_existing_secret() {
        let saved = Cell::new(false);
        let result = validate_then_save(
            "credential",
            |_| Ok(CredentialValidationResult::invalid("unauthorized")),
            |_| {
                saved.set(true);
                Ok(())
            },
        );

        assert_eq!(
            result,
            Err(ConnectionFailure::recoverable("credential_invalid"))
        );
        assert!(!saved.get());
    }

    #[test]
    fn unavailable_capture_does_not_save() {
        let saved = Cell::new(false);
        let result = validate_then_save(
            "credential",
            |_| Ok(CredentialValidationResult::unavailable("network")),
            |_| {
                saved.set(true);
                Ok(())
            },
        );

        assert_eq!(
            result,
            Err(ConnectionFailure::recoverable(
                "credential_validation_unavailable"
            ))
        );
        assert!(!saved.get());
    }

    #[test]
    fn storage_failure_is_redacted() {
        let result = validate_then_save(
            "credential",
            |_| Ok(CredentialValidationResult::valid()),
            |_| Err("secret value leaked in backend message".to_string()),
        );

        assert_eq!(
            result,
            Err(ConnectionFailure::terminal("credential_store_denied"))
        );
        assert!(!format!("{result:?}").contains("secret value"));
    }

    #[test]
    fn cookie_filter_accepts_only_the_exact_non_empty_name() {
        let policy = Provider::Spotify.policy();
        let cookies = vec![
            tauri::webview::Cookie::new("other", "not-it"),
            tauri::webview::Cookie::new("sp_dc_backup", "not-it-either"),
            tauri::webview::Cookie::new("sp_dc", "  expected-value  "),
        ];

        assert_eq!(
            matching_cookie_value(policy, &cookies),
            Some("expected-value".to_string())
        );
        assert_eq!(
            matching_cookie_value(policy, &[tauri::webview::Cookie::new("sp_dc", "   ")]),
            None
        );
    }

    #[test]
    fn recoverable_and_timeout_states_allow_a_new_attempt() {
        for phase in [ConnectionPhase::RecoverableError, ConnectionPhase::TimedOut] {
            let mut registry = ConnectionRegistry::default();
            let first = registry.begin(Provider::Spotify).unwrap();
            assert!(registry.transition(first.connection_id, phase, Some("redacted")));
            assert!(registry.begin(Provider::AppleMusic).is_ok());
        }
    }

    #[test]
    fn cancelled_attempt_cannot_transition_after_worker_wakeup() {
        let mut registry = ConnectionRegistry::default();
        let status = registry.begin(Provider::Spotify).unwrap();
        assert!(registry.cancel(status.connection_id));
        assert!(!registry.transition(status.connection_id, ConnectionPhase::Validating, None));
    }

    #[test]
    fn cancellation_during_validation_prevents_credential_save() {
        let service = ProviderConnectionService::default();
        let status = service.begin(Provider::Spotify).unwrap();
        service.transition(status.connection_id, ConnectionPhase::Validating, None);
        let saved = Cell::new(false);
        let result = validate_then_save(
            "credential",
            |_| {
                assert!(service.cancel(status.connection_id));
                Ok(CredentialValidationResult::valid())
            },
            |_| service.save_if_validating(status.connection_id, || { saved.set(true); Ok(()) }),
        );
        assert!(result.is_err());
        assert!(!saved.get());
        assert_eq!(service.status(status.connection_id).unwrap().unwrap().phase, ConnectionPhase::Cancelled);
    }

    #[test]
    fn replaced_attempt_cannot_save_and_successful_save_is_terminal() {
        let service = ProviderConnectionService::default();
        let first = service.begin(Provider::Spotify).unwrap();
        service.transition(first.connection_id, ConnectionPhase::Validating, None);
        service.cancel(first.connection_id);
        let second = service.begin(Provider::AppleMusic).unwrap();
        service.transition(second.connection_id, ConnectionPhase::Validating, None);
        assert!(service.save_if_validating(first.connection_id, || panic!("stale save")).is_err());
        service.save_if_validating(second.connection_id, || Ok(())).unwrap();
        assert!(!service.cancel(second.connection_id));
        assert_eq!(service.status(second.connection_id).unwrap().unwrap().phase, ConnectionPhase::Connected);
    }
}
