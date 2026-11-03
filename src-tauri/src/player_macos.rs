use base64::{engine::general_purpose, Engine as _};
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};

use crate::player::{CurrentTrack, PlayerCommand, PlayerPosition};
use crate::player_identity::PlayerSource;

// 16 MiB preserves high-resolution artwork; the descriptor budget allows its hex plus framing.
const MAX_ARTWORK_DECODED_BYTES: usize = 16 * 1024 * 1024;
const MAX_ARTWORK_HEX_DIGITS: usize = MAX_ARTWORK_DECODED_BYTES * 2;
const MAX_ARTWORK_DESCRIPTOR_BYTES: usize = MAX_ARTWORK_HEX_DIGITS + 64 * 1024;
// One maximum-size data URL fits while normal smaller artwork can retain several entries.
const MAX_ARTWORK_CACHE_ENTRIES: usize = 32;
const MAX_ARTWORK_CACHE_BYTES: usize = 32 * 1024 * 1024;

static APPLE_MUSIC_ARTWORK_CACHE: OnceLock<Mutex<ArtworkCache>> = OnceLock::new();

struct CachedArtwork {
    value: Option<String>,
    last_used: u64,
}

#[derive(Default)]
struct ArtworkCache {
    entries: HashMap<String, CachedArtwork>,
    retained_bytes: usize,
    access_counter: u64,
}

impl ArtworkCache {
    fn get(&mut self, key: &str) -> Option<&Option<String>> {
        self.access_counter = self.access_counter.saturating_add(1);
        let entry = self.entries.get_mut(key)?;
        entry.last_used = self.access_counter;
        Some(&entry.value)
    }

    fn insert(&mut self, key: String, value: Option<String>) {
        let entry_bytes = artwork_cache_entry_bytes(&key, &value);
        if entry_bytes > MAX_ARTWORK_CACHE_BYTES {
            return;
        }

        if let Some(previous) = self.entries.remove(&key) {
            self.retained_bytes = self
                .retained_bytes
                .saturating_sub(artwork_cache_entry_bytes(&key, &previous.value));
        }

        while self.entries.len() >= MAX_ARTWORK_CACHE_ENTRIES
            || self.retained_bytes + entry_bytes > MAX_ARTWORK_CACHE_BYTES
        {
            let Some(oldest_key) = self
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            let evicted = self.entries.remove(&oldest_key).expect("entry exists");
            self.retained_bytes = self
                .retained_bytes
                .saturating_sub(artwork_cache_entry_bytes(&oldest_key, &evicted.value));
        }

        self.access_counter = self.access_counter.saturating_add(1);
        self.retained_bytes += entry_bytes;
        self.entries.insert(
            key,
            CachedArtwork {
                value,
                last_used: self.access_counter,
            },
        );
    }

    #[cfg(test)]
    fn clear(&mut self) {
        self.entries.clear();
        self.retained_bytes = 0;
        self.access_counter = 0;
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }

    #[cfg(test)]
    fn contains_key(&self, key: &str) -> bool {
        self.entries.contains_key(key)
    }

    #[cfg(test)]
    fn iter(&self) -> impl Iterator<Item = (&String, &Option<String>)> {
        self.entries.iter().map(|(key, entry)| (key, &entry.value))
    }
}

fn artwork_cache_entry_bytes(key: &str, value: &Option<String>) -> usize {
    key.len() + value.as_ref().map_or(0, String::len)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScriptTrack {
    source: String,
    id: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_ms: Option<f64>,
    position_ms: Option<f64>,
    is_playing: bool,
    artwork_url: Option<String>,
    artwork_data: Option<String>,
    genre: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScriptPlayerPosition {
    id: Option<String>,
    position_ms: Option<f64>,
    is_playing: bool,
}

impl From<ScriptTrack> for CurrentTrack {
    fn from(value: ScriptTrack) -> Self {
        Self {
            source: value.source,
            id: value.id,
            title: value.title,
            artist: value.artist,
            album: value.album,
            duration_ms: value.duration_ms.map(round_ms),
            position_ms: value.position_ms.map(round_ms),
            is_playing: value.is_playing,
            artwork_url: value.artwork_url,
            artwork_data: value.artwork_data,
            genre: value.genre,
        }
    }
}

impl From<ScriptPlayerPosition> for PlayerPosition {
    fn from(value: ScriptPlayerPosition) -> Self {
        Self {
            id: value.id.filter(|id| !id.trim().is_empty()),
            position_ms: value.position_ms.map(round_ms).unwrap_or(0),
            is_playing: value.is_playing,
        }
    }
}

pub(crate) fn get_current_track(
    selection: Option<PlayerSource>,
) -> Result<Option<CurrentTrack>, String> {
    get_current_track_inner(selection.map(|source| source.as_str().to_string()))
}

pub(crate) fn get_player_position(
    source: PlayerSource,
    _known_track_id: Option<String>,
) -> Result<Option<PlayerPosition>, String> {
    get_player_position_inner(source.as_str())
}

fn get_player_position_inner(source: &str) -> Result<Option<PlayerPosition>, String> {
    match source {
        "spotify" => run_position_jxa(SPOTIFY_POSITION_SCRIPT),
        "apple_music" => run_position_jxa(APPLE_MUSIC_POSITION_SCRIPT),
        other => Err(format!("Unsupported player source: {other}")),
    }
}

fn get_current_track_inner(source: Option<String>) -> Result<Option<CurrentTrack>, String> {
    let requested = source.unwrap_or_else(|| "auto".to_string());
    match requested.as_str() {
        "spotify" => query_spotify(),
        "apple_music" => query_apple_music(),
        "auto" => query_spotify()?.map_or_else(query_apple_music, |track| Ok(Some(track))),
        other => Err(format!("Unsupported player source: {other}")),
    }
}

pub(crate) fn control_player(
    selection: Option<PlayerSource>,
    command: PlayerCommand,
) -> Result<(), String> {
    let (command, position_ms) = match command {
        PlayerCommand::Play => ("play", None),
        PlayerCommand::Pause => ("pause", None),
        PlayerCommand::Next => ("next", None),
        PlayerCommand::Previous => ("previous", None),
        PlayerCommand::Seek(position_ms) => ("seek", Some(position_ms)),
    };
    control_player_inner(
        command.to_string(),
        selection.map(|source| source.as_str().to_string()),
        position_ms,
    )
}

fn control_player_inner(
    command: String,
    source: Option<String>,
    position_ms: Option<u64>,
) -> Result<(), String> {
    let requested = source.unwrap_or_else(|| "auto".to_string());
    let target = match requested.as_str() {
        "spotify" | "apple_music" => requested,
        "auto" => preferred_source()?,
        other => return Err(format!("Unsupported player source: {other}")),
    };

    match target.as_str() {
        "spotify" => run_control_script("Spotify", &command, position_ms),
        "apple_music" => run_control_script("Music", &command, position_ms),
        _ => Err("No controllable player is active".to_string()),
    }
}

fn query_spotify() -> Result<Option<CurrentTrack>, String> {
    run_jxa(SPOTIFY_SCRIPT)
}

fn query_apple_music() -> Result<Option<CurrentTrack>, String> {
    let Some(mut track) = run_jxa(APPLE_MUSIC_SCRIPT)? else {
        return Ok(None);
    };

    if track.artwork_url.is_none() && track.artwork_data.is_none() {
        track.artwork_data = apple_music_artwork_data_for_track(&track);
    }

    Ok(Some(track))
}

fn run_jxa(script: &str) -> Result<Option<CurrentTrack>, String> {
    let output = Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("Failed to run osascript: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "osascript failed without stderr".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" {
        return Ok(None);
    }

    let parsed: ScriptTrack = serde_json::from_str(&stdout)
        .map_err(|error| format!("Failed to parse player response: {error}. Raw: {stdout}"))?;
    Ok(Some(parsed.into()))
}

fn run_position_jxa(script: &str) -> Result<Option<PlayerPosition>, String> {
    let output = Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("Failed to run osascript: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "osascript failed without stderr".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" {
        return Ok(None);
    }

    let parsed: ScriptPlayerPosition = serde_json::from_str(&stdout)
        .map_err(|error| format!("Failed to parse player position: {error}. Raw: {stdout}"))?;
    Ok(Some(parsed.into()))
}

fn run_control_script(
    app_name: &str,
    command: &str,
    position_ms: Option<u64>,
) -> Result<(), String> {
    let script = match command {
        "play" => format!(r#"Application("{app_name}").play();"#),
        "pause" => format!(r#"Application("{app_name}").pause();"#),
        "next" => format!(r#"Application("{app_name}").nextTrack();"#),
        "previous" => format!(r#"Application("{app_name}").previousTrack();"#),
        "seek" => {
            let seconds = position_ms.unwrap_or(0) as f64 / 1000.0;
            format!(r#"const app = Application("{app_name}"); app.playerPosition = {seconds};"#)
        }
        other => return Err(format!("Unsupported player command: {other}")),
    };

    let output = Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("Failed to run osascript: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "player control failed without stderr".to_string()
        } else {
            stderr
        })
    }
}

fn preferred_source() -> Result<String, String> {
    let spotify = query_spotify()?;
    if spotify.as_ref().is_some_and(|track| track.is_playing) {
        return Ok("spotify".to_string());
    }

    let apple_music = query_apple_music()?;
    if apple_music.as_ref().is_some_and(|track| track.is_playing) {
        return Ok("apple_music".to_string());
    }

    if spotify.is_some() {
        return Ok("spotify".to_string());
    }
    if apple_music.is_some() {
        return Ok("apple_music".to_string());
    }

    Err("No supported player is running".to_string())
}

fn round_ms(value: f64) -> u64 {
    value.max(0.0).round() as u64
}

fn apple_music_artwork_data_for_track(track: &CurrentTrack) -> Option<String> {
    let Some(cache_key) = apple_music_artwork_cache_key(track) else {
        return query_apple_music_artwork_data();
    };

    if let Ok(mut cache) = apple_music_artwork_cache().lock() {
        if let Some(cached) = cache.get(&cache_key).cloned() {
            return cached;
        }
    }

    let artwork_data = query_apple_music_artwork_data();
    if let Ok(mut cache) = apple_music_artwork_cache().lock() {
        cache.insert(cache_key, artwork_data.clone());
    }

    artwork_data
}

fn apple_music_artwork_cache_key(track: &CurrentTrack) -> Option<String> {
    track
        .id
        .as_deref()
        .filter(|id| !id.trim().is_empty())
        .map(|id| id.to_string())
}

fn apple_music_artwork_cache() -> &'static Mutex<ArtworkCache> {
    APPLE_MUSIC_ARTWORK_CACHE.get_or_init(|| Mutex::new(ArtworkCache::default()))
}

fn query_apple_music_artwork_data() -> Option<String> {
    let mut child = Command::new("osascript")
        .arg("-e")
        .arg(
            r#"tell application "Music"
  try
    if (count of artworks of current track) is 0 then return ""
    return raw data of artwork 1 of current track
  on error
    return ""
  end try
end tell"#,
        )
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return None;
    };
    let mut output = Vec::new();
    let read_result = stdout
        .by_ref()
        .take((MAX_ARTWORK_DESCRIPTOR_BYTES + 1) as u64)
        .read_to_end(&mut output);
    drop(stdout);

    if read_result.is_err() || output.len() > MAX_ARTWORK_DESCRIPTOR_BYTES {
        let _ = child.kill();
        let _ = child.wait();
        return None;
    }

    if !child.wait().ok()?.success() {
        return None;
    }

    let descriptor = std::str::from_utf8(&output).ok()?;
    apple_music_artwork_data_url_from_descriptor(descriptor)
}

fn apple_music_artwork_data_url_from_descriptor(descriptor: &str) -> Option<String> {
    if descriptor.len() > MAX_ARTWORK_DESCRIPTOR_BYTES {
        return None;
    }

    let compact = descriptor.trim();
    let start = compact.find("«data ")? + "«data ".len();
    let end = compact[start..]
        .find('»')
        .map(|offset| start + offset)
        .unwrap_or(compact.len());
    let payload = compact[start..end].trim();

    if payload.len() <= 4 {
        return None;
    }

    let hex = payload.get(4..)?;
    let hex_digits = artwork_hex_digit_count(hex)?;
    if hex_digits == 0 || hex_digits % 2 != 0 || hex_digits > MAX_ARTWORK_HEX_DIGITS {
        return None;
    }

    let bytes = decode_hex_bytes(hex, hex_digits / 2)?;
    let mime = artwork_mime_type(&bytes);
    let prefix = format!("data:{mime};base64,");
    let mut data_url = String::with_capacity(prefix.len() + bytes.len().div_ceil(3) * 4);
    data_url.push_str(&prefix);
    general_purpose::STANDARD.encode_string(bytes, &mut data_url);
    Some(data_url)
}

fn artwork_hex_digit_count(hex: &str) -> Option<usize> {
    let mut digits = 0usize;
    for character in hex.chars() {
        if character.is_whitespace() {
            continue;
        }
        if !character.is_ascii_hexdigit() {
            return None;
        }
        digits = digits.checked_add(1)?;
        if digits > MAX_ARTWORK_HEX_DIGITS {
            return None;
        }
    }
    Some(digits)
}

fn decode_hex_bytes(hex: &str, decoded_len: usize) -> Option<Vec<u8>> {
    if decoded_len > MAX_ARTWORK_DECODED_BYTES {
        return None;
    }

    let mut bytes = Vec::with_capacity(decoded_len);
    let mut high_nibble = None;
    for character in hex.chars().filter(|character| !character.is_whitespace()) {
        let nibble = character.to_digit(16)? as u8;
        if let Some(high) = high_nibble.take() {
            bytes.push((high << 4) | nibble);
        } else {
            high_nibble = Some(nibble);
        }
    }

    if high_nibble.is_some() || bytes.len() != decoded_len {
        return None;
    }
    Some(bytes)
}

fn artwork_mime_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else {
        "application/octet-stream"
    }
}

const SPOTIFY_SCRIPT: &str = r#"
const app = Application("Spotify");
if (!app.running()) {
  JSON.stringify(null);
} else {
  const track = app.currentTrack();
  const spotifyUrl = track.spotifyUrl();
  const id = spotifyUrl ? String(spotifyUrl).split(":").pop() : null;
  JSON.stringify({
    source: "spotify",
    id,
    title: track.name(),
    artist: track.artist(),
    album: track.album(),
    durationMs: track.duration(),
    positionMs: Math.round(app.playerPosition() * 1000),
    isPlaying: String(app.playerState()) === "playing",
    artworkUrl: track.artworkUrl(),
    genre: null
  });
}
"#;

const SPOTIFY_POSITION_SCRIPT: &str = r#"
const app = Application("Spotify");
if (!app.running()) {
  JSON.stringify(null);
} else {
  const track = app.currentTrack();
  const spotifyUrl = track.spotifyUrl();
  const id = spotifyUrl ? String(spotifyUrl).split(":").pop() : null;
  JSON.stringify({
    id,
    positionMs: Math.round(app.playerPosition() * 1000),
    isPlaying: String(app.playerState()) === "playing"
  });
}
"#;

const APPLE_MUSIC_SCRIPT: &str = r#"
const app = Application("Music");
if (!app.running()) {
  JSON.stringify(null);
} else {
  const track = app.currentTrack();
  JSON.stringify({
    source: "apple_music",
    id: String(track.persistentID ? track.persistentID() : ""),
    title: track.name(),
    artist: track.artist(),
    album: track.album(),
    durationMs: Math.round(track.duration() * 1000),
    positionMs: Math.round(app.playerPosition() * 1000),
    isPlaying: String(app.playerState()) === "playing",
    artworkUrl: null,
    artworkData: null,
    genre: track.genre ? track.genre() : null
  });
}
"#;

const APPLE_MUSIC_POSITION_SCRIPT: &str = r#"
const app = Application("Music");
if (!app.running()) {
  JSON.stringify(null);
} else {
  const track = app.currentTrack();
  JSON.stringify({
    id: String(track.persistentID ? track.persistentID() : ""),
    positionMs: Math.round(app.playerPosition() * 1000),
    isPlaying: String(app.playerState()) === "playing"
  });
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_apple_music_png_artwork_descriptor_to_data_url() {
        let descriptor = "«data tdta89504E47»";

        assert_eq!(
            apple_music_artwork_data_url_from_descriptor(descriptor),
            Some("data:image/png;base64,iVBORw==".to_string())
        );
    }

    #[test]
    fn ignores_non_artwork_descriptors() {
        assert_eq!(apple_music_artwork_data_url_from_descriptor(""), None);
        assert_eq!(
            apple_music_artwork_data_url_from_descriptor("«data tdtaNOTHEX»"),
            None
        );
    }

    #[test]
    fn security_rejects_artwork_descriptor_over_decoded_budget() {
        let descriptor = format!("«data tdta{}»", "00".repeat(MAX_ARTWORK_DECODED_BYTES + 1));

        assert!(apple_music_artwork_data_url_from_descriptor(&descriptor).is_none());
    }

    #[test]
    fn security_accepts_artwork_at_decoded_budget() {
        let descriptor = format!("«data tdta{}»", "00".repeat(MAX_ARTWORK_DECODED_BYTES));
        let artwork = apple_music_artwork_data_url_from_descriptor(&descriptor)
            .expect("artwork at the decoded byte budget should be accepted");

        assert!(artwork.starts_with("data:application/octet-stream;base64,"));
        assert_eq!(
            artwork.len(),
            "data:application/octet-stream;base64,".len()
                + MAX_ARTWORK_DECODED_BYTES.div_ceil(3) * 4
        );
    }

    #[test]
    fn security_artwork_cache_evicts_to_entry_and_byte_limits() {
        let mut cache = apple_music_artwork_cache().lock().unwrap();
        cache.clear();

        for index in 0..=MAX_ARTWORK_CACHE_ENTRIES {
            cache.insert(format!("track-{index}"), None);
        }

        assert_eq!(cache.len(), MAX_ARTWORK_CACHE_ENTRIES);
        assert!(!cache.contains_key("track-0"));

        cache.clear();
        let cached_artwork_bytes = MAX_ARTWORK_CACHE_BYTES / 2 + 1;
        cache.insert("first".to_string(), Some("a".repeat(cached_artwork_bytes)));
        cache.insert("second".to_string(), Some("b".repeat(cached_artwork_bytes)));

        let retained_bytes = cache
            .iter()
            .map(|(key, value)| key.len() + value.as_ref().map_or(0, String::len))
            .sum::<usize>();
        assert!(retained_bytes <= MAX_ARTWORK_CACHE_BYTES);
        assert!(!cache.contains_key("first"));
        assert!(cache.contains_key("second"));

        cache.clear();
    }
}
