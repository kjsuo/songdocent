#[cfg(target_os = "macos")]
pub(crate) fn register(app: &tauri::AppHandle) {
    crate::player_events_macos::register(app);
}

#[cfg(target_os = "windows")]
pub(crate) fn register(app: &tauri::AppHandle) {
    use serde::Serialize;
    use tauri::Emitter;

    #[derive(Clone, Serialize)]
    struct PlayerChangedEvent {
        source: &'static str,
    }

    let app = app.clone();
    crate::player_events_windows::register(move |source| {
        let _ = app.emit("songdocent-player-changed", PlayerChangedEvent { source });
    });
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) fn register(_app: &tauri::AppHandle) {}

#[cfg(test)]
mod tests {
    use crate::player_identity::{classify_source_app_id, PlayerSource};

    #[test]
    fn maps_supported_windows_session_ids_to_sources() {
        assert_eq!(
            classify_source_app_id("Spotify.exe"),
            Some(PlayerSource::Spotify)
        );
        assert_eq!(
            classify_source_app_id("AppleMusicWin.exe"),
            Some(PlayerSource::AppleMusic)
        );
        assert_eq!(classify_source_app_id("msedge.exe"), None);
    }
}
