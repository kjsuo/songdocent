use std::sync::{Arc, Mutex, OnceLock};

use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    CurrentSessionChangedEventArgs, GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager, MediaPropertiesChangedEventArgs,
    PlaybackInfoChangedEventArgs, SessionsChangedEventArgs, TimelinePropertiesChangedEventArgs,
};

use crate::player_identity::classify_source_app_id;
use crate::winrt_runtime;

type EmitCallback = dyn Fn(&'static str) + Send + Sync + 'static;

static REGISTRATION: OnceLock<Mutex<EventRegistration>> = OnceLock::new();

struct EventRegistration {
    _manager: GlobalSystemMediaTransportControlsSessionManager,
    _current_session_token: i64,
    _sessions_token: i64,
    sessions: Vec<SessionRegistration>,
    emit: Arc<EmitCallback>,
}

struct SessionRegistration {
    _session: GlobalSystemMediaTransportControlsSession,
    _media_token: i64,
    _playback_token: i64,
    _timeline_token: i64,
}

impl Drop for SessionRegistration {
    fn drop(&mut self) {
        let _ = self
            ._session
            .RemoveMediaPropertiesChanged(self._media_token);
        let _ = self
            ._session
            .RemovePlaybackInfoChanged(self._playback_token);
        let _ = self
            ._session
            .RemoveTimelinePropertiesChanged(self._timeline_token);
    }
}

pub(crate) fn register<F>(emit: F)
where
    F: Fn(&'static str) + Send + Sync + 'static,
{
    if REGISTRATION.get().is_some() {
        return;
    }
    let emit: Arc<EmitCallback> = Arc::new(emit);
    let _ = std::thread::Builder::new()
        .name("songdocent-player-events".to_string())
        .spawn(move || {
            if let Err(error) = register_inner(emit) {
                eprintln!("SongDocent Windows player event registration failed: {error}");
            }
        });
}

fn register_inner(emit: Arc<EmitCallback>) -> Result<(), String> {
    winrt_runtime::ensure_initialized()?;
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|error| winrt_error("Failed to request Windows media sessions", error))?
        .join()
        .map_err(|error| winrt_error("Windows media session access denied", error))?;

    let current_emit = Arc::clone(&emit);
    let current_session_token = manager
        .CurrentSessionChanged(&TypedEventHandler::<
            GlobalSystemMediaTransportControlsSessionManager,
            CurrentSessionChangedEventArgs,
        >::new(move |sender, _| {
            if let Some(manager) = sender.as_ref() {
                emit_supported_sessions(manager, &current_emit);
                refresh_session_registrations(manager, &current_emit);
            }
            Ok(())
        }))
        .map_err(|error| winrt_error("Failed to observe current media session", error))?;

    let sessions_emit = Arc::clone(&emit);
    let sessions_token = manager
        .SessionsChanged(&TypedEventHandler::<
            GlobalSystemMediaTransportControlsSessionManager,
            SessionsChangedEventArgs,
        >::new(move |sender, _| {
            if let Some(manager) = sender.as_ref() {
                emit_supported_sessions(manager, &sessions_emit);
                refresh_session_registrations(manager, &sessions_emit);
            }
            Ok(())
        }))
        .map_err(|error| winrt_error("Failed to observe media session list", error))?;

    let sessions = register_session_handlers(&manager, &emit)?;
    let registration = EventRegistration {
        _manager: manager.clone(),
        _current_session_token: current_session_token,
        _sessions_token: sessions_token,
        sessions,
        emit: Arc::clone(&emit),
    };
    REGISTRATION
        .set(Mutex::new(registration))
        .map_err(|_| "Windows player events are already registered".to_string())?;
    emit_supported_sessions(&manager, &emit);
    Ok(())
}

fn register_session_handlers(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    emit: &Arc<EmitCallback>,
) -> Result<Vec<SessionRegistration>, String> {
    let sessions = manager
        .GetSessions()
        .map_err(|error| winrt_error("Failed to enumerate Windows media sessions", error))?;
    let count = sessions
        .Size()
        .map_err(|error| winrt_error("Failed to count Windows media sessions", error))?;
    let mut registrations = Vec::new();

    for index in 0..count {
        let session = sessions
            .GetAt(index)
            .map_err(|error| winrt_error("Failed to read Windows media session", error))?;
        let Some(source) = session_event_source(&session) else {
            continue;
        };

        let media_emit = Arc::clone(emit);
        let media_token = session
            .MediaPropertiesChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSession,
                MediaPropertiesChangedEventArgs,
            >::new(move |_, _| {
                media_emit(source);
                Ok(())
            }))
            .map_err(|error| winrt_error("Failed to observe player metadata", error))?;

        let playback_emit = Arc::clone(emit);
        let playback_token = session
            .PlaybackInfoChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSession,
                PlaybackInfoChangedEventArgs,
            >::new(move |_, _| {
                playback_emit(source);
                Ok(())
            }))
            .map_err(|error| winrt_error("Failed to observe player state", error))?;

        let timeline_emit = Arc::clone(emit);
        let timeline_token = session
            .TimelinePropertiesChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSession,
                TimelinePropertiesChangedEventArgs,
            >::new(move |_, _| {
                timeline_emit(source);
                Ok(())
            }))
            .map_err(|error| winrt_error("Failed to observe player timeline", error))?;

        registrations.push(SessionRegistration {
            _session: session,
            _media_token: media_token,
            _playback_token: playback_token,
            _timeline_token: timeline_token,
        });
    }

    Ok(registrations)
}

fn refresh_session_registrations(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    emit: &Arc<EmitCallback>,
) {
    let Ok(sessions) = register_session_handlers(manager, emit) else {
        return;
    };
    if let Some(registration) = REGISTRATION.get() {
        if let Ok(mut registration) = registration.lock() {
            registration.sessions = sessions;
            registration.emit = Arc::clone(emit);
        }
    }
}

fn emit_supported_sessions(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    emit: &Arc<EmitCallback>,
) {
    let Ok(sessions) = manager.GetSessions() else {
        return;
    };
    let Ok(count) = sessions.Size() else {
        return;
    };
    let mut emitted_spotify = false;
    let mut emitted_apple_music = false;
    for index in 0..count {
        let Some(source) = sessions
            .GetAt(index)
            .ok()
            .as_ref()
            .and_then(session_event_source)
        else {
            continue;
        };
        if source == "spotify" && !emitted_spotify {
            emit(source);
            emitted_spotify = true;
        } else if source == "apple_music" && !emitted_apple_music {
            emit(source);
            emitted_apple_music = true;
        }
    }
}

fn session_event_source(
    session: &GlobalSystemMediaTransportControlsSession,
) -> Option<&'static str> {
    session
        .SourceAppUserModelId()
        .ok()
        .and_then(|value| classify_source_app_id(&value.to_string()))
        .map(|source| source.as_str())
}

fn winrt_error(context: &str, error: windows::core::Error) -> String {
    format!("{context}: 0x{:08X}", error.code().0 as u32)
}
