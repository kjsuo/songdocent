#![cfg_attr(not(target_os = "windows"), allow(dead_code))]

use reqwest::header::{HeaderMap, RETRY_AFTER};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::player_identity::{
    metadata_fingerprint, score_spotify_candidate, PlayerSource, SpotifyCandidate, TrackMetadata,
};
use crate::{cache, lyrics};

const SPOTIFY_PATHFINDER_SEARCH_URL: &str = "https://api-partner.spotify.com/pathfinder/v1/query";
const SPOTIFY_PATHFINDER_SEARCH_OPERATION: &str = "searchDesktop";
const SPOTIFY_PATHFINDER_SEARCH_SHA256: &str =
    "75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec";
const SPOTIFY_WEB_ORIGIN: &str = "https://open.spotify.com";
const SPOTIFY_WEB_REFERER: &str = "https://open.spotify.com/";
const SPOTIFY_WEB_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
const MAX_CACHE_ENTRIES: usize = 256;
const DEFAULT_RETRY_AFTER_SECONDS: u64 = 60;
const MAX_RETRY_AFTER_SECONDS: u64 = 24 * 60 * 60;

static RESOLVER_STATE: OnceLock<Mutex<SpotifyResolverState>> = OnceLock::new();

#[derive(Debug)]
enum SpotifySearchError {
    RateLimited(u64),
    Request(String),
}

impl fmt::Display for SpotifySearchError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RateLimited(seconds) => write!(
                formatter,
                "Spotify track search rate limited; retry after {seconds} seconds"
            ),
            Self::Request(message) => formatter.write_str(message),
        }
    }
}

#[derive(Default)]
struct SpotifyResolverState {
    resolved_tracks: HashMap<String, Option<String>>,
    cooldown_until: Option<Instant>,
    persist_resolutions: bool,
}

impl SpotifyResolverState {
    fn from_persistent_cache() -> Self {
        let resolved_tracks = cache::load_spotify_track_resolutions().unwrap_or_else(|error| {
            eprintln!("SongDocent Spotify resolver cache load failed: {error}");
            HashMap::new()
        });
        Self {
            resolved_tracks,
            cooldown_until: None,
            persist_resolutions: true,
        }
    }

    fn resolve_with<F>(
        &mut self,
        metadata: &TrackMetadata,
        now: Instant,
        mut search: F,
    ) -> Result<Option<String>, String>
    where
        F: FnMut(&TrackMetadata) -> Result<Vec<SpotifyCandidate>, SpotifySearchError>,
    {
        let fingerprint = metadata_fingerprint(PlayerSource::Spotify, metadata);
        if let Some(cached) = self.resolved_tracks.get(&fingerprint) {
            return Ok(cached.clone());
        }

        if let Some(cooldown_until) = self.cooldown_until {
            if now < cooldown_until {
                let remaining = cooldown_until.duration_since(now).as_secs().max(1);
                return Err(SpotifySearchError::RateLimited(remaining).to_string());
            }
            self.cooldown_until = None;
        }

        let candidates = match search(metadata) {
            Ok(candidates) => candidates,
            Err(SpotifySearchError::RateLimited(seconds)) => {
                let seconds = seconds.clamp(1, MAX_RETRY_AFTER_SECONDS);
                self.cooldown_until = now.checked_add(Duration::from_secs(seconds));
                return Err(SpotifySearchError::RateLimited(seconds).to_string());
            }
            Err(error) => return Err(error.to_string()),
        };
        let resolved = select_best_candidate(metadata, candidates);
        self.cache_resolution(fingerprint, resolved.clone());
        Ok(resolved)
    }

    fn cache_resolution(&mut self, fingerprint: String, resolved: Option<String>) {
        if self.resolved_tracks.len() >= MAX_CACHE_ENTRIES {
            if let Some(oldest) = self.resolved_tracks.keys().next().cloned() {
                self.resolved_tracks.remove(&oldest);
            }
        }
        self.resolved_tracks.insert(fingerprint, resolved);
        if self.persist_resolutions {
            if let Err(error) = cache::save_spotify_track_resolutions(&self.resolved_tracks) {
                eprintln!("SongDocent Spotify resolver cache save failed: {error}");
            }
        }
    }
}

pub fn resolve_spotify_track_id(metadata: &TrackMetadata) -> Result<Option<String>, String> {
    resolver_state()
        .lock()
        .map_err(|_| "Spotify resolver state is unavailable".to_string())?
        .resolve_with(metadata, Instant::now(), search_spotify_candidates)
}

fn search_spotify_candidates(
    metadata: &TrackMetadata,
) -> Result<Vec<SpotifyCandidate>, SpotifySearchError> {
    let token = lyrics::get_spotify_token().map_err(SpotifySearchError::Request)?;
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| {
            SpotifySearchError::Request(format!(
                "Spotify pathfinder client initialization failed: {error}"
            ))
        })?;
    let query = normalized_search_query(metadata);
    let variables = serde_json::to_string(&json!({
        "searchTerm": query,
        "offset": 0,
        "limit": 10,
        "numberOfTopResults": 5,
    }))
    .map_err(|error| {
        SpotifySearchError::Request(format!(
            "Spotify pathfinder variables serialization failed: {error}"
        ))
    })?;
    let extensions = serde_json::to_string(&json!({
        "persistedQuery": {
            "version": 1,
            "sha256Hash": SPOTIFY_PATHFINDER_SEARCH_SHA256,
        }
    }))
    .map_err(|error| {
        SpotifySearchError::Request(format!(
            "Spotify pathfinder extensions serialization failed: {error}"
        ))
    })?;
    let response = client
        .get(SPOTIFY_PATHFINDER_SEARCH_URL)
        .query(&[
            (
                "operationName",
                SPOTIFY_PATHFINDER_SEARCH_OPERATION.to_string(),
            ),
            ("variables", variables),
            ("extensions", extensions),
        ])
        .header("Accept", "application/json")
        .header("Origin", SPOTIFY_WEB_ORIGIN)
        .header("Referer", SPOTIFY_WEB_REFERER)
        .header("User-Agent", SPOTIFY_WEB_USER_AGENT)
        .bearer_auth(token)
        .send()
        .map_err(|error| {
            SpotifySearchError::Request(format!("Spotify pathfinder search failed: {error}"))
        })?;

    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(SpotifySearchError::RateLimited(parse_retry_after(
            response.headers(),
        )));
    }
    if !response.status().is_success() {
        return Err(SpotifySearchError::Request(format!(
            "Spotify pathfinder search failed: {}",
            response.status()
        )));
    }

    let payload = response.text().map_err(|error| {
        SpotifySearchError::Request(format!(
            "Spotify pathfinder search response read failed: {error}"
        ))
    })?;
    parse_pathfinder_candidates(&payload).map_err(SpotifySearchError::Request)
}

fn parse_retry_after(headers: &HeaderMap) -> u64 {
    headers
        .get(RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .map(|seconds| seconds.clamp(1, MAX_RETRY_AFTER_SECONDS))
        .unwrap_or(DEFAULT_RETRY_AFTER_SECONDS)
}

fn normalized_search_query(metadata: &TrackMetadata) -> String {
    format!("{} {}", metadata.title, metadata.artist)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_pathfinder_candidates(payload: &str) -> Result<Vec<SpotifyCandidate>, String> {
    let parsed: Value = serde_json::from_str(payload)
        .map_err(|error| format!("Spotify pathfinder search response parse failed: {error}"))?;
    let mut candidates = Vec::new();
    collect_pathfinder_candidates(&parsed, &mut candidates);

    let mut seen = HashSet::new();
    candidates.retain(|candidate| seen.insert(candidate.id.clone()));
    Ok(candidates)
}

fn collect_pathfinder_candidates(value: &Value, candidates: &mut Vec<SpotifyCandidate>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_pathfinder_candidates(item, candidates);
            }
        }
        Value::Object(object) => {
            if let Some(candidate) = pathfinder_object_to_candidate(object) {
                candidates.push(candidate);
            }
            for child in object.values() {
                collect_pathfinder_candidates(child, candidates);
            }
        }
        _ => {}
    }
}

fn pathfinder_object_to_candidate(object: &Map<String, Value>) -> Option<SpotifyCandidate> {
    let uri = object.get("uri").and_then(Value::as_str).unwrap_or("");
    if !uri.is_empty() && !uri.starts_with("spotify:track:") {
        return None;
    }

    let id = object
        .get("id")
        .and_then(value_to_text)
        .or_else(|| uri.strip_prefix("spotify:track:").map(str::to_string))?
        .trim()
        .to_string();
    let title = object
        .get("name")
        .or_else(|| object.get("title"))
        .and_then(value_to_text)?
        .trim()
        .to_string();
    let duration_ms = pathfinder_duration_ms(object)?;
    let artists = pathfinder_artist_names(object.get("artists"))
        .into_iter()
        .chain(pathfinder_artist_names(object.get("artistsV2")))
        .collect::<Vec<_>>();
    let album = object
        .get("albumOfTrack")
        .or_else(|| object.get("album"))
        .and_then(pathfinder_named_object_text);

    if id.is_empty() || title.is_empty() || artists.is_empty() {
        return None;
    }

    Some(SpotifyCandidate {
        id,
        title,
        artists,
        album,
        duration_ms,
    })
}

fn pathfinder_duration_ms(object: &Map<String, Value>) -> Option<u64> {
    object
        .get("duration_ms")
        .or_else(|| object.get("durationMs"))
        .and_then(Value::as_u64)
        .or_else(|| {
            object
                .get("duration")
                .and_then(Value::as_object)
                .and_then(|duration| {
                    duration
                        .get("totalMilliseconds")
                        .or_else(|| duration.get("total_milliseconds"))
                        .and_then(Value::as_u64)
                })
        })
}

fn pathfinder_artist_names(value: Option<&Value>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };

    if let Some(items) = value.get("items").and_then(Value::as_array) {
        return items
            .iter()
            .filter_map(pathfinder_named_object_text)
            .collect();
    }

    if let Some(items) = value.as_array() {
        return items
            .iter()
            .filter_map(pathfinder_named_object_text)
            .collect();
    }

    pathfinder_named_object_text(value).into_iter().collect()
}

fn pathfinder_named_object_text(value: &Value) -> Option<String> {
    value_to_text(value)
        .or_else(|| value.get("name").and_then(value_to_text))
        .or_else(|| value.get("title").and_then(value_to_text))
        .or_else(|| value.get("profile")?.get("name").and_then(value_to_text))
        .or_else(|| value.get("item").and_then(pathfinder_named_object_text))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn value_to_text(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn select_best_candidate(
    metadata: &TrackMetadata,
    candidates: Vec<SpotifyCandidate>,
) -> Option<String> {
    candidates
        .into_iter()
        .map(|candidate| {
            let score = score_spotify_candidate(metadata, &candidate);
            (candidate, score)
        })
        .filter(|(_, score)| score.is_confident())
        .max_by_key(|(_, score)| score.value)
        .map(|(candidate, _)| candidate.id)
}

fn resolver_state() -> &'static Mutex<SpotifyResolverState> {
    RESOLVER_STATE.get_or_init(|| Mutex::new(SpotifyResolverState::from_persistent_cache()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::player_identity::{SpotifyCandidate, TrackMetadata};
    use reqwest::header::{HeaderMap, HeaderValue, RETRY_AFTER};
    use std::env;

    #[test]
    #[ignore = "requires an explicit opt-in, Spotify credentials, and network access"]
    fn live_resolves_spotify_track_id_from_metadata() {
        assert_eq!(
            env::var("SONGDOCENT_RUN_SPOTIFY_LIVE_TEST").as_deref(),
            Ok("1"),
            "set SONGDOCENT_RUN_SPOTIFY_LIVE_TEST=1 to opt in"
        );
        let title =
            env::var("SONGDOCENT_SPOTIFY_TEST_TITLE").expect("SONGDOCENT_SPOTIFY_TEST_TITLE is required");
        let artist =
            env::var("SONGDOCENT_SPOTIFY_TEST_ARTIST").expect("SONGDOCENT_SPOTIFY_TEST_ARTIST is required");
        let album = env::var("SONGDOCENT_SPOTIFY_TEST_ALBUM").ok();
        let duration_ms = env::var("SONGDOCENT_SPOTIFY_TEST_DURATION_MS")
            .ok()
            .map(|value| {
                value
                    .parse::<u64>()
                    .expect("SONGDOCENT_SPOTIFY_TEST_DURATION_MS must be an integer")
            });
        let metadata = TrackMetadata::new(&title, &artist, album.as_deref(), duration_ms);

        let track_id = resolve_spotify_track_id(&metadata)
            .expect("Spotify resolver request failed")
            .expect("Spotify resolver found no confident match");

        println!("resolved Spotify track ID: {track_id}");
    }

    #[test]
    fn rate_limit_cooldown_blocks_follow_up_searches() {
        let metadata = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let now = Instant::now();
        let mut state = SpotifyResolverState::default();
        let mut calls = 0;

        let first = state.resolve_with(&metadata, now, |_| {
            calls += 1;
            Err(SpotifySearchError::RateLimited(86_400))
        });
        let second = state.resolve_with(&metadata, now + Duration::from_secs(1), |_| {
            calls += 1;
            Ok(Vec::new())
        });

        assert!(first.unwrap_err().contains("86400"));
        assert!(second.unwrap_err().contains("86399"));
        assert_eq!(calls, 1);
    }

    #[test]
    fn parses_retry_after_seconds_with_bounded_fallback() {
        let mut headers = HeaderMap::new();
        headers.insert(RETRY_AFTER, HeaderValue::from_static("86400"));
        assert_eq!(parse_retry_after(&headers), 86_400);

        headers.insert(RETRY_AFTER, HeaderValue::from_static("not-a-number"));
        assert_eq!(parse_retry_after(&headers), DEFAULT_RETRY_AFTER_SECONDS);
    }

    #[test]
    fn successful_resolutions_are_available_after_state_reload() {
        let _guard = crate::cache::TEST_CACHE_LOCK
            .lock()
            .expect("test cache lock");
        let cache_file = env::temp_dir().join(format!(
            "songdocent-spotify-resolver-test-{}-{}-cache.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock")
                .as_nanos()
        ));
        env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);
        let metadata = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let mut state = SpotifyResolverState::from_persistent_cache();

        let resolved = state
            .resolve_with(&metadata, Instant::now(), |_| {
                Ok(vec![SpotifyCandidate::new(
                    "track-1",
                    "Hello",
                    vec!["Adele"],
                    Some("25"),
                    295_000,
                )])
            })
            .expect("resolution should succeed");
        let reloaded = SpotifyResolverState::from_persistent_cache();
        let fingerprint = metadata_fingerprint(PlayerSource::Spotify, &metadata);

        assert_eq!(resolved.as_deref(), Some("track-1"));
        assert_eq!(
            reloaded.resolved_tracks.get(&fingerprint),
            Some(&Some("track-1".to_string()))
        );
        let _ = std::fs::remove_file(cache_file);
        env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn builds_plain_pathfinder_search_queries_from_metadata() {
        let metadata = TrackMetadata::new(
            "  Die   With A Smile  ",
            " Lady Gaga   Bruno Mars ",
            None,
            None,
        );

        assert_eq!(
            normalized_search_query(&metadata),
            "Die With A Smile Lady Gaga Bruno Mars"
        );
    }

    #[test]
    fn parses_pathfinder_candidates_from_nested_search_payload() {
        let payload = r#"{
          "data": {
            "search": {
              "topResults": {
                "items": [{
                  "uri": "spotify:track:2plbrEY59IikOBgBGLjaoe",
                  "id": "2plbrEY59IikOBgBGLjaoe",
                  "name": "Die With A Smile",
                  "duration": { "totalMilliseconds": 251667 },
                  "artists": {
                    "items": [
                      { "profile": { "name": "Lady Gaga" } },
                      { "profile": { "name": "Bruno Mars" } }
                    ]
                  }
                }]
              },
              "tracks": {
                "items": [{
                  "track": {
                    "uri": "spotify:track:2plbrEY59IikOBgBGLjaoe",
                    "id": "2plbrEY59IikOBgBGLjaoe",
                    "name": "Die With A Smile",
                    "duration": { "totalMilliseconds": 251667 },
                    "albumOfTrack": { "name": "MAYHEM" },
                    "artists": {
                      "items": [
                        { "profile": { "name": "Lady Gaga" } },
                        { "profile": { "name": "Bruno Mars" } }
                      ]
                    }
                  }
                }, {
                  "track": {
                    "uri": "spotify:track:7so0lgd0zP2Sbgs2d7a1SZ",
                    "id": "7so0lgd0zP2Sbgs2d7a1SZ",
                    "name": "Die With A Smile",
                    "durationMs": 251667,
                    "album": { "name": "Die With A Smile" },
                    "artists": [
                      { "name": "Lady Gaga" },
                      { "name": "Bruno Mars" }
                    ]
                  }
                }]
              }
            }
          }
        }"#;

        let candidates = parse_pathfinder_candidates(payload).unwrap();

        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].id, "2plbrEY59IikOBgBGLjaoe");
        assert_eq!(candidates[0].title, "Die With A Smile");
        assert_eq!(candidates[0].artists, vec!["Lady Gaga", "Bruno Mars"]);
        assert_eq!(candidates[0].duration_ms, 251_667);
        assert_eq!(candidates[1].id, "7so0lgd0zP2Sbgs2d7a1SZ");
        assert_eq!(candidates[1].album.as_deref(), Some("Die With A Smile"));
    }

    #[test]
    fn skips_incomplete_pathfinder_candidates() {
        let payload = r#"{
          "data": {
            "search": {
              "tracks": {
                "items": [
                  { "track": {
                    "uri": "spotify:artist:not-a-track",
                    "id": "artist",
                    "name": "Adele",
                    "duration": { "totalMilliseconds": 1 },
                    "artists": { "items": [{ "profile": { "name": "Adele" } }] }
                  }},
                  { "track": {
                    "uri": "spotify:track:missing-artist",
                    "id": "missing-artist",
                    "name": "Broken",
                    "duration": { "totalMilliseconds": 1 },
                    "artists": { "items": [] }
                  }},
                  { "track": {
                    "uri": "spotify:track:ok",
                    "id": "ok",
                    "name": "Hello",
                    "duration": { "totalMilliseconds": 295000 },
                    "artists": { "items": [{ "profile": { "name": "Adele" } }] },
                    "albumOfTrack": { "name": "25" }
                  }}
                ]
              }
            }
          }
        }"#;

        let candidates = parse_pathfinder_candidates(payload).unwrap();

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "ok");
        assert_eq!(candidates[0].artists, vec!["Adele"]);
        assert_eq!(candidates[0].album.as_deref(), Some("25"));
    }

    #[test]
    fn selects_best_confident_candidate() {
        let query = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let candidates = vec![
            SpotifyCandidate::new("wrong", "Hello", vec!["Other Artist"], Some("25"), 295_000),
            SpotifyCandidate::new("right", "Hello", vec!["Adele"], Some("25"), 295_200),
        ];

        assert_eq!(
            select_best_candidate(&query, candidates),
            Some("right".into())
        );
    }

    #[test]
    fn returns_none_when_no_candidate_is_confident() {
        let query = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let candidates = vec![SpotifyCandidate::new(
            "wrong",
            "Hello",
            vec!["Other"],
            None,
            295_000,
        )];

        assert_eq!(select_best_candidate(&query, candidates), None);
    }
}
