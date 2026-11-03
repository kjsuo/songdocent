use base64::{engine::general_purpose, Engine as _};
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;

use crate::player::{CurrentTrack, PlayerCommand, PlayerPosition};
use crate::player_identity::{
    classify_source_app_id, metadata_fingerprint, ms_to_winrt_ticks, winrt_ticks_to_ms,
    PlayerSource, TrackMetadata,
};
use crate::spotify_resolver::resolve_spotify_track_id;
use crate::player_timeline::estimate_position_ms;
use crate::winrt_runtime;

const MAX_ARTWORK_BYTES: u64 = 16 * 1024 * 1024;

pub(crate) fn get_current_track(
    source: Option<PlayerSource>,
) -> Result<Option<CurrentTrack>, String> {
    let Some((session, source)) = find_session(source)? else {
        return Ok(None);
    };

    let properties = session
        .TryGetMediaPropertiesAsync()
        .map_err(|error| winrt_error("Failed to request player metadata", error))?
        .join()
        .map_err(|error| winrt_error("Failed to read player metadata", error))?;
    let metadata = track_metadata(&session, &properties)?;
    if metadata.title.is_empty() || metadata.artist.is_empty() {
        return Err("Player response is missing title or artist".to_string());
    }

    let timeline = session
        .GetTimelineProperties()
        .map_err(|error| winrt_error("Failed to read player timeline", error))?;
    let duration_ms = timeline
        .EndTime()
        .ok()
        .map(|value| winrt_ticks_to_ms(value.Duration))
        .filter(|value| *value > 0)
        .or_else(|| {
            timeline
                .MaxSeekTime()
                .ok()
                .map(|value| winrt_ticks_to_ms(value.Duration))
                .filter(|value| *value > 0)
        });
    let metadata = TrackMetadata {
        duration_ms: duration_ms.or(metadata.duration_ms),
        ..metadata
    };
    let id = resolve_track_id(source, &metadata);
    let artwork_data = read_artwork_data(&properties).ok().flatten();
    let genre = first_genre(&properties);
    // Sample after metadata/artwork work so slow lookups cannot rewind the UI clock.
    let (position_ms, is_playing) = session_position(&session)?;

    Ok(Some(CurrentTrack {
        source: source.as_str().to_string(),
        id,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration_ms: metadata.duration_ms,
        position_ms: Some(position_ms),
        is_playing,
        artwork_url: None,
        artwork_data,
        genre,
    }))
}

pub(crate) fn get_player_position(
    source: PlayerSource,
    known_track_id: Option<String>,
) -> Result<Option<PlayerPosition>, String> {
    let Some((session, _)) = find_session(Some(source))? else {
        return Ok(None);
    };
    let known_track_id = known_track_id
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty());
    let (position_ms, is_playing) = session_position(&session)?;
    Ok(Some(PlayerPosition {
        id: known_track_id,
        position_ms,
        is_playing,
    }))
}

pub(crate) fn control_player(
    source: Option<PlayerSource>,
    command: PlayerCommand,
) -> Result<(), String> {
    let Some((session, _)) = find_session(source)? else {
        return Err("No supported player is running".to_string());
    };
    let supported = match command {
        PlayerCommand::Play => session
            .TryPlayAsync()
            .map_err(|error| winrt_error("Failed to request play", error))?
            .join(),
        PlayerCommand::Pause => session
            .TryPauseAsync()
            .map_err(|error| winrt_error("Failed to request pause", error))?
            .join(),
        PlayerCommand::Next => session
            .TrySkipNextAsync()
            .map_err(|error| winrt_error("Failed to request next track", error))?
            .join(),
        PlayerCommand::Previous => session
            .TrySkipPreviousAsync()
            .map_err(|error| winrt_error("Failed to request previous track", error))?
            .join(),
        PlayerCommand::Seek(position_ms) => session
            .TryChangePlaybackPositionAsync(ms_to_winrt_ticks(position_ms))
            .map_err(|error| winrt_error("Failed to request seek", error))?
            .join(),
    }
    .map_err(|error| winrt_error("Player control failed", error))?;

    if supported {
        Ok(())
    } else {
        Err("The active player does not support this command".to_string())
    }
}

fn find_session(
    requested: Option<PlayerSource>,
) -> Result<Option<(GlobalSystemMediaTransportControlsSession, PlayerSource)>, String> {
    winrt_runtime::ensure_initialized()?;
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|error| winrt_error("Failed to request Windows media sessions", error))?
        .join()
        .map_err(|error| winrt_error("Windows media session access denied", error))?;
    let sessions = manager
        .GetSessions()
        .map_err(|error| winrt_error("Failed to enumerate Windows media sessions", error))?;
    let count = sessions
        .Size()
        .map_err(|error| winrt_error("Failed to count Windows media sessions", error))?;
    let mut fallback = None;

    for index in 0..count {
        let session = sessions
            .GetAt(index)
            .map_err(|error| winrt_error("Failed to read Windows media session", error))?;
        let Some(source) = session_source(&session) else {
            continue;
        };
        if requested.is_some_and(|requested| requested != source) {
            continue;
        }
        if requested.is_some() {
            return Ok(Some((session, source)));
        }
        if playback_is_playing(&session).unwrap_or(false) {
            return Ok(Some((session, source)));
        }
        if fallback.is_none() {
            fallback = Some((session, source));
        }
    }

    Ok(fallback)
}

fn session_source(session: &GlobalSystemMediaTransportControlsSession) -> Option<PlayerSource> {
    session
        .SourceAppUserModelId()
        .ok()
        .and_then(|value| classify_source_app_id(&value.to_string()))
}

fn track_metadata(
    _session: &GlobalSystemMediaTransportControlsSession,
    properties: &GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Result<TrackMetadata, String> {
    let title = properties
        .Title()
        .map_err(|error| winrt_error("Failed to read player title", error))?
        .to_string();
    let artist = properties
        .Artist()
        .ok()
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            properties
                .AlbumArtist()
                .ok()
                .map(|value| value.to_string())
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_default();
    let album = properties
        .AlbumTitle()
        .ok()
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty());

    Ok(TrackMetadata::new(&title, &artist, album.as_deref(), None))
}

fn playback_is_playing(
    session: &GlobalSystemMediaTransportControlsSession,
) -> Result<bool, String> {
    let status = session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .map_err(|error| winrt_error("Failed to read player state", error))?;
    Ok(status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
}

fn session_position(
    session: &GlobalSystemMediaTransportControlsSession,
) -> Result<(u64, bool), String> {
    let info = session
        .GetPlaybackInfo()
        .map_err(|error| winrt_error("Failed to read player state", error))?;
    let is_playing = info.PlaybackStatus()
        .map_err(|error| winrt_error("Failed to read player state", error))?
        == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
    let timeline = session.GetTimelineProperties()
        .map_err(|error| winrt_error("Failed to read player timeline", error))?;
    let position_ms = timeline.Position()
        .map(|value| winrt_ticks_to_ms(value.Duration))
        .map_err(|error| winrt_error("Failed to read player position", error))?;
    // WinRT timestamps count 100 ns ticks since 1601; SystemTime uses the Unix epoch.
    let updated_at_ms = timeline.LastUpdatedTime().ok()
        .and_then(|time| u64::try_from(time.UniversalTime / 10_000 - 11_644_473_600_000).ok());
    let now_ms = SystemTime::now().duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u64::MAX as u128) as u64)
        .unwrap_or(0);
    let rate = info.PlaybackRate().and_then(|rate| rate.Value()).ok();
    let end_ms = timeline.EndTime().ok().map(|end| winrt_ticks_to_ms(end.Duration));
    Ok((estimate_position_ms(position_ms, updated_at_ms, now_ms, is_playing, rate, end_ms), is_playing))
}

fn resolve_track_id(source: PlayerSource, metadata: &TrackMetadata) -> Option<String> {
    match source {
        PlayerSource::Spotify => match resolve_spotify_track_id(metadata) {
            Ok(resolved) => resolved,
            Err(error) => {
                eprintln!("SongDocent Spotify identity resolution failed: {error}");
                None
            }
        },
        PlayerSource::AppleMusic => Some(metadata_fingerprint(source, metadata)),
    }
}

fn first_genre(
    properties: &GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Option<String> {
    let genres = properties.Genres().ok()?;
    if genres.Size().ok()? == 0 {
        return None;
    }
    genres
        .GetAt(0)
        .ok()
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
}

fn read_artwork_data(
    properties: &GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Result<Option<String>, String> {
    let reference = match properties.Thumbnail() {
        Ok(reference) => reference,
        Err(_) => return Ok(None),
    };
    let stream = reference
        .OpenReadAsync()
        .map_err(|error| winrt_error("Failed to request player artwork", error))?
        .join()
        .map_err(|error| winrt_error("Failed to open player artwork", error))?;
    let size = stream
        .Size()
        .map_err(|error| winrt_error("Failed to read player artwork size", error))?;
    if size == 0 {
        return Ok(None);
    }
    if size > MAX_ARTWORK_BYTES || size > u32::MAX as u64 {
        return Err(format!(
            "Player artwork exceeds {MAX_ARTWORK_BYTES} byte limit"
        ));
    }

    let reader = DataReader::CreateDataReader(&stream)
        .map_err(|error| winrt_error("Failed to create player artwork reader", error))?;
    let loaded = reader
        .LoadAsync(size as u32)
        .map_err(|error| winrt_error("Failed to request player artwork bytes", error))?
        .join()
        .map_err(|error| winrt_error("Failed to load player artwork bytes", error))?;
    if loaded != size as u32 {
        return Err("Player artwork stream ended early".to_string());
    }
    let mut bytes = vec![0u8; loaded as usize];
    reader
        .ReadBytes(&mut bytes)
        .map_err(|error| winrt_error("Failed to read player artwork bytes", error))?;
    let _ = reader.Close();

    let mime = stream
        .ContentType()
        .ok()
        .map(|value| value.to_string())
        .filter(|value| value.starts_with("image/"))
        .unwrap_or_else(|| artwork_mime_type(&bytes).to_string());
    Ok(Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    )))
}

fn artwork_mime_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

fn winrt_error(context: &str, error: windows::core::Error) -> String {
    format!("{context}: 0x{:08X}", error.code().0 as u32)
}
