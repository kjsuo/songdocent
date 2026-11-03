use serde::Serialize;

use crate::app_error::{AppError, ErrorDomain};
use crate::player_identity::PlayerSource;

#[cfg(target_os = "macos")]
use crate::player_macos as backend;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
use crate::player_unsupported as backend;
#[cfg(target_os = "windows")]
use crate::player_windows as backend;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurrentTrack {
    pub(crate) source: String,
    pub(crate) id: Option<String>,
    pub(crate) title: String,
    pub(crate) artist: String,
    pub(crate) album: Option<String>,
    pub(crate) duration_ms: Option<u64>,
    pub(crate) position_ms: Option<u64>,
    pub(crate) is_playing: bool,
    pub(crate) artwork_url: Option<String>,
    pub(crate) artwork_data: Option<String>,
    pub(crate) genre: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlayerPosition {
    pub(crate) id: Option<String>,
    pub(crate) position_ms: u64,
    pub(crate) is_playing: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum PlayerCommand {
    Play,
    Pause,
    Next,
    Previous,
    Seek(u64),
}

impl PlayerCommand {
    fn parse(command: &str, position_ms: Option<u64>) -> Result<Self, String> {
        match command.trim() {
            "play" => Ok(Self::Play),
            "pause" => Ok(Self::Pause),
            "next" => Ok(Self::Next),
            "previous" => Ok(Self::Previous),
            "seek" => position_ms
                .map(Self::Seek)
                .ok_or_else(|| "Seek requires position_ms".to_string()),
            other => Err(format!("Unsupported player command: {other}")),
        }
    }
}

fn parse_source(source: &str) -> Result<PlayerSource, String> {
    match source.trim() {
        "spotify" => Ok(PlayerSource::Spotify),
        "apple_music" => Ok(PlayerSource::AppleMusic),
        other => Err(format!("Unsupported player source: {other}")),
    }
}

fn parse_selection(source: Option<&str>) -> Result<Option<PlayerSource>, String> {
    match source.map(str::trim) {
        None | Some("") | Some("auto") => Ok(None),
        Some(source) => parse_source(source).map(Some),
    }
}

#[tauri::command]
pub async fn get_current_track(source: Option<String>) -> Result<Option<CurrentTrack>, AppError> {
    let selection = parse_selection(source.as_deref()).map_err(AppError::player)?;
    let result =
        tauri::async_runtime::spawn_blocking(move || backend::get_current_track(selection))
            .await
            .map_err(|error| {
                AppError::task(
                    ErrorDomain::Player,
                    "Player state task failed",
                    error.to_string(),
                )
            })?;
    result.map_err(AppError::player)
}

#[tauri::command]
pub async fn get_player_position(
    source: String,
    track_id: Option<String>,
) -> Result<Option<PlayerPosition>, AppError> {
    let source = parse_source(&source).map_err(AppError::player)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        backend::get_player_position(source, track_id)
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Player,
            "Player position task failed",
            error.to_string(),
        )
    })?;
    result.map_err(AppError::player)
}

#[tauri::command]
pub async fn control_player(
    command: String,
    source: Option<String>,
    position_ms: Option<u64>,
) -> Result<(), AppError> {
    let selection = parse_selection(source.as_deref()).map_err(AppError::player)?;
    let command = PlayerCommand::parse(&command, position_ms).map_err(AppError::player)?;
    let result =
        tauri::async_runtime::spawn_blocking(move || backend::control_player(selection, command))
            .await
            .map_err(|error| {
                AppError::task(
                    ErrorDomain::Player,
                    "Player control task failed",
                    error.to_string(),
                )
            })?;
    result.map_err(AppError::player)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;

    #[test]
    fn player_commands_return_futures() {
        fn assert_track_command<F, Fut>(_command: F)
        where
            F: FnOnce(Option<String>) -> Fut,
            Fut: Future<Output = Result<Option<CurrentTrack>, AppError>>,
        {
        }
        fn assert_control_command<F, Fut>(_command: F)
        where
            F: FnOnce(String, Option<String>, Option<u64>) -> Fut,
            Fut: Future<Output = Result<(), AppError>>,
        {
        }
        fn assert_position_command<F, Fut>(_command: F)
        where
            F: FnOnce(String, Option<String>) -> Fut,
            Fut: Future<Output = Result<Option<PlayerPosition>, AppError>>,
        {
        }

        assert_track_command(get_current_track);
        assert_control_command(control_player);
        assert_position_command(get_player_position);
    }

    #[test]
    fn rejects_unknown_player_source() {
        assert_eq!(
            parse_source("browser").unwrap_err(),
            "Unsupported player source: browser"
        );
    }

    #[test]
    fn parses_supported_player_sources() {
        assert_eq!(parse_source("spotify"), Ok(PlayerSource::Spotify));
        assert_eq!(parse_source("apple_music"), Ok(PlayerSource::AppleMusic));
    }

    #[test]
    fn parses_auto_source_selection() {
        assert_eq!(parse_selection(None), Ok(None));
        assert_eq!(parse_selection(Some("auto")), Ok(None));
    }

    #[test]
    fn rejects_seek_without_position() {
        assert_eq!(
            PlayerCommand::parse("seek", None).unwrap_err(),
            "Seek requires position_ms"
        );
    }

    #[test]
    fn parses_seek_position() {
        assert_eq!(
            PlayerCommand::parse("seek", Some(42_000)),
            Ok(PlayerCommand::Seek(42_000))
        );
    }
}
