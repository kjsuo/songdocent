use objc2::rc::Retained;
use objc2::{define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::{
    ns_string, NSDistributedNotificationCenter, NSNotification, NSObject, NSObjectProtocol,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const SPOTIFY_NOTIFICATION: &str = "com.spotify.client.PlaybackStateChanged";
const APPLE_MUSIC_NOTIFICATION: &str = "com.apple.Music.playerInfo";

fn source_for_notification_name(name: &str) -> Option<&'static str> {
    match name {
        SPOTIFY_NOTIFICATION => Some("spotify"),
        APPLE_MUSIC_NOTIFICATION => Some("apple_music"),
        _ => None,
    }
}

#[derive(Clone, Serialize)]
struct PlayerChangedEvent {
    source: &'static str,
}

struct PlayerNotificationObserverIvars {
    app: AppHandle,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = PlayerNotificationObserverIvars]
    struct PlayerNotificationObserver;

    impl PlayerNotificationObserver {
        #[unsafe(method(playerNotification:))]
        fn player_notification(&self, notification: &NSNotification) {
            let name = notification.name().to_string();
            let Some(source) = source_for_notification_name(&name) else {
                return;
            };
            let _ = self
                .ivars()
                .app
                .emit("songdocent-player-changed", PlayerChangedEvent { source });
        }
    }

    unsafe impl NSObjectProtocol for PlayerNotificationObserver {}
);

impl PlayerNotificationObserver {
    fn new(app: AppHandle, mtm: MainThreadMarker) -> Retained<Self> {
        let observer = Self::alloc(mtm).set_ivars(PlayerNotificationObserverIvars { app });
        unsafe { msg_send![super(observer), init] }
    }
}

pub fn register(app: &AppHandle) {
    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("SongDocent player event observer must be registered on the main thread");
        return;
    };
    let observer = PlayerNotificationObserver::new(app.clone(), mtm);
    let center = NSDistributedNotificationCenter::defaultCenter();

    unsafe {
        center.addObserver_selector_name_object(
            &observer,
            sel!(playerNotification:),
            Some(ns_string!("com.spotify.client.PlaybackStateChanged")),
            None,
        );
        center.addObserver_selector_name_object(
            &observer,
            sel!(playerNotification:),
            Some(ns_string!("com.apple.Music.playerInfo")),
            None,
        );
    }

    // The notification center does not retain selector-based observers.
    // SongDocent owns one observer for the lifetime of the process.
    std::mem::forget(observer);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_supported_player_notifications_to_sources() {
        assert_eq!(
            source_for_notification_name(SPOTIFY_NOTIFICATION),
            Some("spotify")
        );
        assert_eq!(
            source_for_notification_name(APPLE_MUSIC_NOTIFICATION),
            Some("apple_music")
        );
        assert_eq!(source_for_notification_name("unknown"), None);
    }
}
