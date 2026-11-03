use crate::player::{CurrentTrack, PlayerCommand, PlayerPosition};
use crate::player_identity::PlayerSource;

const UNSUPPORTED: &str = "Windows media controls are unavailable on this platform";

pub(crate) fn get_current_track(
    _source: Option<PlayerSource>,
) -> Result<Option<CurrentTrack>, String> {
    Err(UNSUPPORTED.to_string())
}

pub(crate) fn get_player_position(
    _source: PlayerSource,
    _known_track_id: Option<String>,
) -> Result<Option<PlayerPosition>, String> {
    Err(UNSUPPORTED.to_string())
}

pub(crate) fn control_player(
    _source: Option<PlayerSource>,
    _command: PlayerCommand,
) -> Result<(), String> {
    Err(UNSUPPORTED.to_string())
}
