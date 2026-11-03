const SERVICE: &str = "SongDocent";
const UNIFIED_ACCOUNT: &str = "secrets_v1";
const STORE_VERSION: u8 = 1;

use crate::app_error::AppError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SecretKind {
    SpotifySpDc,
    AppleMusicMediaUserToken,
    OpenAiApiKey,
    GeminiApiKey,
    ClaudeApiKey,
    OpenAiCompatibleApiKey,
}

impl SecretKind {
    fn from_name(kind: &str) -> Result<Self, String> {
        match kind {
            "spotify_sp_dc" => Ok(Self::SpotifySpDc),
            "apple_music_media_user_token" => Ok(Self::AppleMusicMediaUserToken),
            "openai_api_key" => Ok(Self::OpenAiApiKey),
            "gemini_api_key" => Ok(Self::GeminiApiKey),
            "claude_api_key" => Ok(Self::ClaudeApiKey),
            "openai_compatible_api_key" => Ok(Self::OpenAiCompatibleApiKey),
            other => Err(format!("Unsupported secret kind: {other}")),
        }
    }
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct SecretStore {
    version: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    spotify_sp_dc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    apple_music_media_user_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    openai_api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gemini_api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    claude_api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    openai_compatible_api_key: Option<String>,
}

impl Default for SecretStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            spotify_sp_dc: None,
            apple_music_media_user_token: None,
            openai_api_key: None,
            gemini_api_key: None,
            claude_api_key: None,
            openai_compatible_api_key: None,
        }
    }
}

impl SecretStore {
    fn decode(value: &str) -> Result<Self, String> {
        let store: Self = serde_json::from_str(value).map_err(|error| {
            format!("Failed to decode system credential store secrets: {error}")
        })?;
        if store.version != STORE_VERSION {
            return Err(format!(
                "Unsupported system credential store version: {}",
                store.version
            ));
        }
        Ok(store)
    }

    fn encode(&self) -> Result<String, String> {
        serde_json::to_string(self)
            .map_err(|error| format!("Failed to encode system credential store secrets: {error}"))
    }

    fn get(&self, kind: SecretKind) -> Option<&str> {
        match kind {
            SecretKind::SpotifySpDc => self.spotify_sp_dc.as_deref(),
            SecretKind::AppleMusicMediaUserToken => self.apple_music_media_user_token.as_deref(),
            SecretKind::OpenAiApiKey => self.openai_api_key.as_deref(),
            SecretKind::GeminiApiKey => self.gemini_api_key.as_deref(),
            SecretKind::ClaudeApiKey => self.claude_api_key.as_deref(),
            SecretKind::OpenAiCompatibleApiKey => self.openai_compatible_api_key.as_deref(),
        }
    }

    fn set(&mut self, kind: SecretKind, value: String) {
        let field = match kind {
            SecretKind::SpotifySpDc => &mut self.spotify_sp_dc,
            SecretKind::AppleMusicMediaUserToken => &mut self.apple_music_media_user_token,
            SecretKind::OpenAiApiKey => &mut self.openai_api_key,
            SecretKind::GeminiApiKey => &mut self.gemini_api_key,
            SecretKind::ClaudeApiKey => &mut self.claude_api_key,
            SecretKind::OpenAiCompatibleApiKey => &mut self.openai_compatible_api_key,
        };
        *field = Some(value);
    }

    fn remove(&mut self, kind: SecretKind) {
        let field = match kind {
            SecretKind::SpotifySpDc => &mut self.spotify_sp_dc,
            SecretKind::AppleMusicMediaUserToken => &mut self.apple_music_media_user_token,
            SecretKind::OpenAiApiKey => &mut self.openai_api_key,
            SecretKind::GeminiApiKey => &mut self.gemini_api_key,
            SecretKind::ClaudeApiKey => &mut self.claude_api_key,
            SecretKind::OpenAiCompatibleApiKey => &mut self.openai_compatible_api_key,
        };
        *field = None;
    }

    fn is_empty(&self) -> bool {
        self.spotify_sp_dc.is_none()
            && self.apple_music_media_user_token.is_none()
            && self.openai_api_key.is_none()
            && self.gemini_api_key.is_none()
            && self.claude_api_key.is_none()
            && self.openai_compatible_api_key.is_none()
    }

    fn status(&self) -> SecretStatus {
        SecretStatus {
            spotify_sp_dc: self.spotify_sp_dc.is_some(),
            apple_music_media_user_token: self.apple_music_media_user_token.is_some(),
            openai_api_key: self.openai_api_key.is_some(),
            gemini_api_key: self.gemini_api_key.is_some(),
            claude_api_key: self.claude_api_key.is_some(),
            openai_compatible_api_key: self.openai_compatible_api_key.is_some(),
        }
    }
}

trait CredentialBackend {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, value: &str) -> Result<(), String>;
    fn delete(&self, account: &str) -> Result<(), String>;
}

struct KeyringBackend;

impl KeyringBackend {
    fn entry(account: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, account)
            .map_err(|error| format!("Failed to open system credential store entry: {error}"))
    }
}

impl CredentialBackend for KeyringBackend {
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match Self::entry(account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!(
                "Failed to read system credential store secret: {error}"
            )),
        }
    }

    fn set(&self, account: &str, value: &str) -> Result<(), String> {
        Self::entry(account)?
            .set_password(value)
            .map_err(|error| format!("Failed to save system credential store secrets: {error}"))
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        match Self::entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Failed to clear system credential store secret: {error}"
            )),
        }
    }
}

fn load_store<B: CredentialBackend>(backend: &B) -> Result<Option<SecretStore>, String> {
    backend
        .get(UNIFIED_ACCOUNT)?
        .map(|raw| SecretStore::decode(&raw))
        .transpose()
}

fn set_secret_with_backend<B: CredentialBackend>(
    backend: &B,
    kind: SecretKind,
    value: &str,
) -> Result<(), String> {
    let mut store = load_store(backend)?.unwrap_or_default();
    store.set(kind, value.to_string());
    backend.set(UNIFIED_ACCOUNT, &store.encode()?)
}

fn clear_secret_with_backend<B: CredentialBackend>(
    backend: &B,
    kind: SecretKind,
) -> Result<(), String> {
    let Some(mut store) = load_store(backend)? else {
        return Ok(());
    };

    store.remove(kind);
    if store.is_empty() {
        backend.delete(UNIFIED_ACCOUNT)
    } else {
        backend.set(UNIFIED_ACCOUNT, &store.encode()?)
    }
}

#[tauri::command]
pub fn get_secret_status() -> Result<SecretStatus, AppError> {
    load_store(&KeyringBackend)
        .map(|store| store.unwrap_or_default().status())
        .map_err(AppError::settings)
}

#[tauri::command]
pub fn set_secret(kind: String, value: String) -> Result<(), AppError> {
    save_secret_value(&kind, &value).map_err(AppError::settings)
}

pub(crate) fn save_secret_value(kind: &str, value: &str) -> Result<(), String> {
    let kind = SecretKind::from_name(kind)?;
    let value = value.trim();
    if value.is_empty() {
        return Err("Secret value is empty.".to_string());
    }

    set_secret_with_backend(&KeyringBackend, kind, value)
}

#[tauri::command]
pub fn clear_secret(kind: String) -> Result<(), AppError> {
    clear_secret_inner(kind).map_err(AppError::settings)
}

fn clear_secret_inner(kind: String) -> Result<(), String> {
    clear_secret_with_backend(&KeyringBackend, SecretKind::from_name(&kind)?)
}

pub fn load_sp_dc() -> Result<Option<String>, String> {
    load_key_with_env(SecretKind::SpotifySpDc, "SP_DC")
}

pub fn load_apple_music_media_user_token() -> Result<Option<String>, String> {
    load_key_with_env(SecretKind::AppleMusicMediaUserToken, "APPLE_MUSIC_MEDIA_USER_TOKEN")
}

pub fn load_openai_api_key() -> Result<Option<String>, String> {
    load_key_with_env(SecretKind::OpenAiApiKey, "OPENAI_API_KEY")
}

pub fn load_gemini_api_key() -> Result<Option<String>, String> {
    load_key_with_env(SecretKind::GeminiApiKey, "GEMINI_API_KEY")
}

pub fn load_claude_api_key() -> Result<Option<String>, String> {
    load_key_with_env(SecretKind::ClaudeApiKey, "ANTHROPIC_API_KEY")
}

pub fn load_openai_compatible_api_key() -> Result<Option<String>, String> {
    load_key(SecretKind::OpenAiCompatibleApiKey)
}

fn load_key_with_env(kind: SecretKind, env_name: &str) -> Result<Option<String>, String> {
    let fallback = std::env::var(env_name).ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    resolve_key_fallback(load_key(kind), fallback)
}

fn resolve_key_fallback(stored: Result<Option<String>, String>, fallback: Option<String>) -> Result<Option<String>, String> {
    match stored {
        Ok(value) => Ok(value.or(fallback)),
        Err(_) if fallback.is_some() => Ok(fallback),
        Err(error) => Err(error),
    }
}

fn load_key_with_backend<B: CredentialBackend>(backend: &B, kind: SecretKind) -> Result<Option<String>, String> {
    Ok(load_store(backend)?
        .and_then(|store| store.get(kind).map(str::to_string))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty()))
}

fn load_key(kind: SecretKind) -> Result<Option<String>, String> {
    load_key_with_backend(&KeyringBackend, kind)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStatus {
    spotify_sp_dc: bool,
    apple_music_media_user_token: bool,
    openai_api_key: bool,
    gemini_api_key: bool,
    claude_api_key: bool,
    openai_compatible_api_key: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, collections::HashMap};

    #[derive(Default)]
    struct MemoryBackend {
        items: RefCell<HashMap<String, String>>,
        gets: RefCell<Vec<String>>,
    }

    impl MemoryBackend {
        fn with<const N: usize>(items: [(&str, &str); N]) -> Self {
            Self {
                items: RefCell::new(
                    items
                        .into_iter()
                        .map(|(account, value)| (account.to_string(), value.to_string()))
                        .collect(),
                ),
                ..Self::default()
            }
        }

        fn contains(&self, account: &str) -> bool {
            self.items.borrow().contains_key(account)
        }

        fn value(&self, account: &str) -> Option<String> {
            self.items.borrow().get(account).cloned()
        }
    }

    impl CredentialBackend for MemoryBackend {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            self.gets.borrow_mut().push(account.to_string());
            Ok(self.items.borrow().get(account).cloned())
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            self.items
                .borrow_mut()
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            self.items.borrow_mut().remove(account);
            Ok(())
        }
    }

    #[test]
    fn key_loading_distinguishes_missing_credentials_from_store_failure() {
        assert_eq!(resolve_key_fallback(Err("denied".into()), Some("configured-env-key".into())).unwrap(), Some("configured-env-key".into()));
        assert!(resolve_key_fallback(Err("denied".into()), None).is_err());
        let missing = MemoryBackend::default();
        assert_eq!(load_key_with_backend(&missing, SecretKind::SpotifySpDc).unwrap(), None);
        let corrupt = MemoryBackend::with([(UNIFIED_ACCOUNT, "invalid-json")]);
        assert!(load_key_with_backend(&corrupt, SecretKind::SpotifySpDc).unwrap_err()
            .contains("decode system credential store"));
        struct DeniedBackend;
        impl CredentialBackend for DeniedBackend {
            fn get(&self, _: &str) -> Result<Option<String>, String> {
                Err("Failed to read system credential store secret: access denied".into())
            }
            fn set(&self, _: &str, _: &str) -> Result<(), String> { unreachable!() }
            fn delete(&self, _: &str) -> Result<(), String> { unreachable!() }
        }
        assert!(load_key_with_backend(&DeniedBackend, SecretKind::GeminiApiKey).unwrap_err()
            .contains("access denied"));
    }

    #[test]
    fn secret_store_round_trips_and_preserves_other_fields() {
        let mut store = SecretStore::default();
        store.set(SecretKind::SpotifySpDc, "spotify".into());
        store.set(SecretKind::AppleMusicMediaUserToken, "apple".into());

        let encoded = store.encode().unwrap();
        let mut decoded = SecretStore::decode(&encoded).unwrap();
        decoded.set(SecretKind::OpenAiApiKey, "openai".into());
        decoded.set(SecretKind::OpenAiCompatibleApiKey, "vendor".into());

        assert_eq!(decoded.get(SecretKind::SpotifySpDc), Some("spotify"));
        assert_eq!(
            decoded.get(SecretKind::AppleMusicMediaUserToken),
            Some("apple")
        );
        assert_eq!(decoded.get(SecretKind::OpenAiApiKey), Some("openai"));
        assert_eq!(decoded.get(SecretKind::OpenAiCompatibleApiKey), Some("vendor"));
    }

    #[test]
    fn secret_store_deleting_the_last_secret_makes_it_empty() {
        let mut store = SecretStore::default();
        store.set(SecretKind::GeminiApiKey, "gemini".into());

        store.remove(SecretKind::GeminiApiKey);

        assert!(store.is_empty());
    }

    #[test]
    fn secret_store_derives_all_statuses_from_one_document() {
        let mut store = SecretStore::default();
        store.set(SecretKind::SpotifySpDc, "spotify".into());
        store.set(SecretKind::GeminiApiKey, "gemini".into());

        let status = store.status();

        assert!(status.spotify_sp_dc);
        assert!(!status.apple_music_media_user_token);
        assert!(!status.openai_api_key);
        assert!(status.gemini_api_key);
        assert!(!status.claude_api_key);
        assert!(!status.openai_compatible_api_key);
    }

    #[test]
    fn secret_store_rejects_malformed_json_and_unknown_versions() {
        assert!(SecretStore::decode("not-json").is_err());
        assert!(SecretStore::decode(r#"{"version":2}"#).is_err());
    }

    #[test]
    fn unified_store_missing_item_does_not_read_legacy_accounts() {
        let backend = MemoryBackend::with([("apple_music_media_user_token", "legacy")]);

        assert!(load_store(&backend).unwrap().is_none());

        assert_eq!(backend.gets.borrow().as_slice(), [UNIFIED_ACCOUNT]);
        assert!(backend.contains("apple_music_media_user_token"));
    }

    #[test]
    fn unified_api_set_preserves_unrelated_secrets() {
        let mut initial = SecretStore::default();
        initial.set(SecretKind::SpotifySpDc, "spotify".into());
        initial.set(SecretKind::AppleMusicMediaUserToken, "apple".into());
        let encoded = initial.encode().unwrap();
        let backend = MemoryBackend::with([(UNIFIED_ACCOUNT, encoded.as_str())]);

        set_secret_with_backend(&backend, SecretKind::OpenAiApiKey, "openai").unwrap();

        let saved = SecretStore::decode(&backend.value(UNIFIED_ACCOUNT).unwrap()).unwrap();
        assert_eq!(saved.get(SecretKind::SpotifySpDc), Some("spotify"));
        assert_eq!(
            saved.get(SecretKind::AppleMusicMediaUserToken),
            Some("apple")
        );
        assert_eq!(saved.get(SecretKind::OpenAiApiKey), Some("openai"));
    }

    #[test]
    fn unified_api_clear_deletes_the_item_after_the_last_secret() {
        let mut initial = SecretStore::default();
        initial.set(SecretKind::GeminiApiKey, "gemini".into());
        let encoded = initial.encode().unwrap();
        let backend = MemoryBackend::with([(UNIFIED_ACCOUNT, encoded.as_str())]);

        clear_secret_with_backend(&backend, SecretKind::GeminiApiKey).unwrap();

        assert!(!backend.contains(UNIFIED_ACCOUNT));
    }

    #[test]
    fn unified_store_existing_item_never_reads_or_deletes_legacy_items() {
        let mut initial = SecretStore::default();
        initial.set(SecretKind::AppleMusicMediaUserToken, "new-apple".into());
        let encoded = initial.encode().unwrap();
        let backend = MemoryBackend::with([
            (UNIFIED_ACCOUNT, encoded.as_str()),
            ("apple_music_media_user_token", "old-apple"),
        ]);

        let loaded = load_store(&backend).unwrap().unwrap();

        assert_eq!(
            loaded.get(SecretKind::AppleMusicMediaUserToken),
            Some("new-apple")
        );
        assert_eq!(backend.gets.borrow().as_slice(), [UNIFIED_ACCOUNT]);
        assert!(backend.contains("apple_music_media_user_token"));
    }
}
