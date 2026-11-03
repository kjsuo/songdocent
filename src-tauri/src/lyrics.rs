use hmac::{Hmac, Mac};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::Sha1;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::app_error::{AppError, ErrorDomain};
use crate::secrets;

type HmacSha1 = Hmac<Sha1>;

const SECRETS_URL: &str = "https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
const IOS_USER_AGENT: &str = "Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)";
const APPLE_MUSIC_ORIGIN: &str = "https://music.apple.com";
const APPLE_MUSIC_REFERER: &str = "https://music.apple.com/";
const METADATA_TIMEOUT_SECONDS: u64 = 2;
const SPOTIFY_TOKEN_REFRESH_MARGIN_MS: u64 = 60_000;
const SPOTIFY_TOKEN_FALLBACK_TTL_MS: u64 = 5 * 60_000;

static ITUNES_GENRE_CACHE: OnceLock<Mutex<HashMap<String, Option<ItunesGenreMetadata>>>> =
    OnceLock::new();
static APPLE_MUSIC_ACCESS_TOKEN_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static SPOTIFY_ACCESS_TOKEN_CACHE: OnceLock<Mutex<SpotifyTokenCache>> = OnceLock::new();

#[derive(Default)]
struct SpotifyTokenCache {
    entry: Option<CachedSpotifyToken>,
}

struct CachedSpotifyToken {
    credential: String,
    access_token: String,
    expires_at_ms: u64,
}

impl SpotifyTokenCache {
    fn get(&self, credential: &str, now_ms: u64) -> Option<String> {
        let entry = self.entry.as_ref()?;
        (entry.credential == credential
            && entry.expires_at_ms.saturating_sub(now_ms) > SPOTIFY_TOKEN_REFRESH_MARGIN_MS)
            .then(|| entry.access_token.clone())
    }

    fn store(&mut self, credential: &str, access_token: &str, expires_at_ms: u64) {
        self.entry = Some(CachedSpotifyToken {
            credential: credential.to_string(),
            access_token: access_token.to_string(),
            expires_at_ms,
        });
    }
}

#[derive(Debug, Serialize)]
pub struct LyricsPayload {
    track_id: String,
    song_url: String,
    title: Option<String>,
    artist: Option<String>,
    artist_id: Option<String>,
    genre: Option<String>,
    genre_hint: Option<String>,
    has_synced_lyrics: bool,
    has_unsynced_lyrics: bool,
    sync_type: String,
    lines: Vec<LyricLine>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LyricLine {
    index: usize,
    start_ms: u64,
    end_ms: u64,
    timestamp: String,
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawLyricLine {
    start_time_ms: String,
    words: Option<String>,
    end_time_ms: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq)]
struct AppleMusicStorefront {
    id: String,
    language: String,
}

#[derive(Clone, Debug, Default, PartialEq)]
struct AppleMusicCatalogSong {
    id: String,
    name: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    url: Option<String>,
    genre: Option<String>,
    duration_ms: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ProviderRequestError {
    Timeout,
    Network,
    Http(u16),
    InvalidResponse,
    InvalidInput,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum SpotifyTokenParseError {
    Anonymous,
    InvalidShape,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ItunesGenreMetadata {
    genre: String,
    genre_hint: String,
    genre_source: String,
    genre_confidence: i32,
    matched_title: Option<String>,
    matched_artist: Option<String>,
    matched_album: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ItunesSearchResponse {
    results: Vec<ItunesSearchTrack>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ItunesSearchTrack {
    wrapper_type: Option<String>,
    kind: Option<String>,
    artist_name: Option<String>,
    collection_name: Option<String>,
    track_name: Option<String>,
    primary_genre_name: Option<String>,
    track_time_millis: Option<u64>,
}

#[derive(Debug, Default)]
struct PendingTtmlLine {
    text: String,
    begin_ms: Option<u64>,
    end_ms: Option<u64>,
    span_begin_ms: Option<u64>,
    span_end_ms: Option<u64>,
}

#[tauri::command]
pub async fn get_spotify_lyrics(
    track_id: String,
    title: Option<String>,
    artist: Option<String>,
) -> Result<Option<LyricsPayload>, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        get_spotify_lyrics_inner(track_id, title, artist)
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Lyrics,
            "Spotify lyrics task failed",
            error.to_string(),
        )
    })?;

    result.map_err(AppError::lyrics)
}

fn get_spotify_lyrics_inner(
    track_id: String,
    title: Option<String>,
    artist: Option<String>,
) -> Result<Option<LyricsPayload>, String> {
    let track_id = extract_track_id(&track_id);
    if track_id.is_empty() {
        return Err("track_id is required".to_string());
    }

    let token = get_spotify_token()?;
    let lyrics_client = reqwest::blocking::Client::new();
    let response = lyrics_client
        .get(format!(
            "https://spclient.wg.spotify.com/color-lyrics/v2/track/{track_id}?format=json&market=from_token"
        ))
        .header("Accept", "application/json")
        .header("Accept-Language", "en")
        .header("Accept-Encoding", "identity")
        .header("User-Agent", IOS_USER_AGENT)
        .bearer_auth(&token)
        .send()
        .map_err(|error| format!("Spotify lyrics request failed: {error}"))?;

    if response.status().as_u16() == 404 {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "Spotify lyrics request failed: {}",
            response.status()
        ));
    }

    let data: Value = response
        .json()
        .map_err(|error| format!("Spotify lyrics response parse failed: {error}"))?;
    let Some(lyrics) = data.get("lyrics") else {
        return Ok(None);
    };

    let sync_type = lyrics
        .get("syncType")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let is_synced = sync_type == "LINE_SYNCED";
    let raw_lines: Vec<RawLyricLine> = serde_json::from_value(
        lyrics
            .get("lines")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    )
    .map_err(|error| format!("Spotify lyrics lines parse failed: {error}"))?;

    let lines = normalize_lines(raw_lines);
    if lines.is_empty() {
        return Ok(None);
    }

    Ok(Some(LyricsPayload {
        track_id: track_id.clone(),
        song_url: format!("https://open.spotify.com/track/{track_id}"),
        title,
        artist,
        artist_id: None,
        genre: None,
        genre_hint: None,
        has_synced_lyrics: is_synced,
        has_unsynced_lyrics: !is_synced,
        sync_type,
        lines,
    }))
}

#[tauri::command]
pub async fn get_apple_music_lyrics(
    track_id: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    genre: Option<String>,
) -> Result<Option<LyricsPayload>, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        get_apple_music_lyrics_inner(track_id, title, artist, album, duration_ms, genre)
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Lyrics,
            "Apple Music lyrics task failed",
            error.to_string(),
        )
    })?;

    result.map_err(AppError::lyrics)
}

fn get_apple_music_lyrics_inner(
    track_id: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    genre: Option<String>,
) -> Result<Option<LyricsPayload>, String> {
    let title = title.trim().to_string();
    let artist = artist.trim().to_string();
    if title.is_empty() || artist.is_empty() {
        return Err("title and artist are required".to_string());
    }

    let media_user_token = secrets::load_apple_music_media_user_token()?.ok_or_else(|| {
        "Apple Music media-user-token is missing. Save it in Settings or set APPLE_MUSIC_MEDIA_USER_TOKEN before launching SongDocent."
            .to_string()
    })?;
    let client = apple_music_client().map_err(provider_request_error_message)?;
    let storefront = get_apple_music_storefront(&client, &media_user_token)?;
    let search_response = search_apple_music_catalog_song(
        &client,
        &media_user_token,
        &storefront,
        &title,
        &artist,
        album.as_deref(),
    )?;
    let catalog_song = select_apple_music_song(
        &search_response,
        &title,
        &artist,
        album.as_deref(),
        duration_ms,
    )
    .ok_or_else(|| format!("Apple Music catalog song not found for {artist} - {title}"))?;

    let song_response = fetch_apple_music_song(
        &client,
        &media_user_token,
        &storefront,
        &catalog_song.id,
    )?;
    let Some(ttml) = extract_apple_music_ttml(&song_response) else {
        return Ok(None);
    };
    let lines = parse_apple_music_ttml_lines(&ttml)?;
    if lines.is_empty() {
        return Ok(None);
    }

    let is_synced = lines
        .iter()
        .any(|line| line.start_ms > 0 || line.end_ms > line.start_ms);
    let payload_track_id = track_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&catalog_song.id)
        .to_string();
    let genre = catalog_song.genre.or(genre);

    Ok(Some(LyricsPayload {
        track_id: payload_track_id,
        song_url: catalog_song.url.unwrap_or_else(|| {
            format!(
                "https://music.apple.com/{}/song/{}",
                storefront.id, catalog_song.id
            )
        }),
        title: catalog_song.name.or(Some(title)),
        artist: catalog_song.artist.or(Some(artist)),
        artist_id: None,
        genre: genre.clone(),
        genre_hint: genre,
        has_synced_lyrics: is_synced,
        has_unsynced_lyrics: !is_synced,
        sync_type: "APPLE_TTML".to_string(),
        lines,
    }))
}

#[tauri::command]
pub fn resolve_itunes_genre(
    title: String,
    artist: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    country: Option<String>,
) -> Result<Option<ItunesGenreMetadata>, AppError> {
    resolve_itunes_genre_inner(title, artist, album, duration_ms, country).map_err(AppError::lyrics)
}

fn resolve_itunes_genre_inner(
    title: String,
    artist: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    country: Option<String>,
) -> Result<Option<ItunesGenreMetadata>, String> {
    let title = title.trim().to_string();
    let artist = artist.trim().to_string();
    if title.is_empty() || artist.is_empty() {
        return Ok(None);
    }

    let countries = itunes_search_countries(country.as_deref());
    let cache_key =
        itunes_genre_cache_key(&title, &artist, album.as_deref(), duration_ms, &countries);
    if let Some(cached) = cached_itunes_genre(&cache_key) {
        return Ok(cached);
    }

    let client = metadata_client();
    let mut best_match: Option<(i32, ItunesSearchTrack)> = None;
    for country in countries {
        let response = client
            .get("https://itunes.apple.com/search")
            .query(&[
                ("term", format!("{artist} {title}")),
                ("country", country.to_string()),
                ("media", "music".to_string()),
                ("entity", "song".to_string()),
                ("limit", "10".to_string()),
                ("lang", "en_us".to_string()),
            ])
            .header("Accept", "application/json")
            .header("User-Agent", USER_AGENT)
            .send()
            .map_err(|error| format!("iTunes genre search failed: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("iTunes genre search failed: {}", response.status()));
        }

        let data: ItunesSearchResponse = response
            .json()
            .map_err(|error| format!("iTunes genre search parse failed: {error}"))?;
        for candidate in data.results {
            let Some(genre) = candidate.primary_genre_name.as_deref() else {
                continue;
            };
            if genre.trim().is_empty() {
                continue;
            }
            let score =
                score_itunes_track(&candidate, &title, &artist, album.as_deref(), duration_ms);
            if score >= 145 {
                let metadata = itunes_metadata_from_track(candidate, score);
                cache_itunes_genre(&cache_key, Some(metadata.clone()));
                return Ok(Some(metadata));
            }
            if best_match
                .as_ref()
                .map(|(best_score, _)| score > *best_score)
                .unwrap_or(true)
            {
                best_match = Some((score, candidate));
            }
        }
    }

    let resolved = best_match
        .filter(|(score, _)| *score >= 75)
        .map(|(score, track)| itunes_metadata_from_track(track, score));
    cache_itunes_genre(&cache_key, resolved.clone());
    Ok(resolved)
}

pub(crate) fn apple_music_client() -> Result<reqwest::blocking::Client, ProviderRequestError> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(classify_provider_request_error)
}

pub(crate) fn retry_apple_music_with_fresh_developer_token<T, E>(
    mut fetch_token: impl FnMut() -> Result<String, E>,
    mut request: impl FnMut(&str) -> Result<T, E>,
    status: impl Fn(&T) -> u16,
    mut invalidate_token: impl FnMut(),
) -> Result<T, E> {
    let token = fetch_token()?;
    let response = request(&token)?;
    if matches!(status(&response), 401 | 403) {
        invalidate_token();
        let fresh_token = fetch_token()?;
        request(&fresh_token)
    } else {
        Ok(response)
    }
}

fn apple_music_request(
    client: &reqwest::blocking::Client,
    request: impl FnMut(&str) -> Result<reqwest::blocking::Response, ProviderRequestError>,
) -> Result<reqwest::blocking::Response, ProviderRequestError> {
    retry_apple_music_with_fresh_developer_token(
        || get_apple_music_access_token(client), request,
        |response| response.status().as_u16(), invalidate_cached_apple_music_access_token,
    )
}

pub(crate) fn get_apple_music_access_token(
    client: &reqwest::blocking::Client,
) -> Result<String, ProviderRequestError> {
    if let Some(token) = cached_apple_music_access_token() {
        return Ok(token);
    }

    let browse = client
        .get("https://music.apple.com/us/browse")
        .header("User-Agent", USER_AGENT)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .map_err(classify_provider_request_error)?;
    if !browse.status().is_success() {
        return Err(ProviderRequestError::Http(browse.status().as_u16()));
    }
    let browse_html = browse.text().map_err(classify_provider_request_error)?;
    let asset_path = extract_apple_music_index_asset(&browse_html)
        .ok_or(ProviderRequestError::InvalidResponse)?;
    let asset_url = if asset_path.starts_with("http") {
        asset_path
    } else {
        format!(
            "{APPLE_MUSIC_ORIGIN}/{}",
            asset_path.trim_start_matches('/')
        )
    };

    let script = client
        .get(&asset_url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "*/*")
        .send()
        .map_err(classify_provider_request_error)?;
    if !script.status().is_success() {
        return Err(ProviderRequestError::Http(script.status().as_u16()));
    }
    let script_text = script.text().map_err(classify_provider_request_error)?;
    let token = extract_apple_music_access_token(&script_text)
        .ok_or(ProviderRequestError::InvalidResponse)?;
    cache_apple_music_access_token(&token);
    Ok(token)
}

fn cached_apple_music_access_token() -> Option<String> {
    APPLE_MUSIC_ACCESS_TOKEN_CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|token| token.clone())
}

fn cache_apple_music_access_token(token: &str) {
    if let Ok(mut cached) = APPLE_MUSIC_ACCESS_TOKEN_CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
    {
        *cached = Some(token.to_string());
    }
}

pub(crate) fn invalidate_cached_apple_music_access_token() {
    if let Ok(mut cached) = APPLE_MUSIC_ACCESS_TOKEN_CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
    {
        *cached = None;
    }
}

fn extract_apple_music_index_asset(html: &str) -> Option<String> {
    let start = html.find("assets/index")?;
    let rest = &html[start..];
    let end = rest.find(".js")?;
    Some(rest[..end + 3].to_string())
}

fn extract_apple_music_access_token(script: &str) -> Option<String> {
    script.match_indices("eyJ").find_map(|(start, _)| {
        let token: String = script[start..]
            .chars()
            .take_while(|char| char.is_ascii_alphanumeric() || matches!(char, '.' | '-' | '_'))
            .collect();
        (token.matches('.').count() >= 2).then_some(token)
    })
}

fn get_apple_music_storefront(
    client: &reqwest::blocking::Client,
    media_user_token: &str,
) -> Result<AppleMusicStorefront, String> {
    let response = apple_music_request(client, |access_token| {
        request_apple_music_storefront(client, access_token, media_user_token)
    })
        .map_err(provider_request_error_message)?;
    if !response.status().is_success() {
        return Err(format!(
            "Apple Music storefront request failed: {}",
            response.status()
        ));
    }
    let data: Value = response
        .json()
        .map_err(|error| format!("Apple Music storefront parse failed: {error}"))?;
    let item = data
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| "Apple Music storefront missing in response".to_string())?;
    let id = item
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Apple Music storefront id missing in response".to_string())?;
    let language = item
        .get("attributes")
        .and_then(|attributes| attributes.get("defaultLanguageTag"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("en-US");

    Ok(AppleMusicStorefront {
        id: id.to_string(),
        language: language.to_string(),
    })
}

pub(crate) fn request_apple_music_storefront(
    client: &reqwest::blocking::Client,
    access_token: &str,
    media_user_token: &str,
) -> Result<reqwest::blocking::Response, ProviderRequestError> {
    client
        .get("https://amp-api.music.apple.com/v1/me/storefront")
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("media-user-token", media_user_token)
        .header("Origin", APPLE_MUSIC_ORIGIN)
        .header("Referer", APPLE_MUSIC_REFERER)
        .header("User-Agent", USER_AGENT)
        .send()
        .map_err(classify_provider_request_error)
}

pub(crate) fn has_valid_apple_music_storefront(data: &Value) -> bool {
    data.get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|id| !id.is_empty())
}

fn search_apple_music_catalog_song(
    client: &reqwest::blocking::Client,
    media_user_token: &str,
    storefront: &AppleMusicStorefront,
    title: &str,
    artist: &str,
    album: Option<&str>,
) -> Result<Value, String> {
    let term = apple_music_search_term(title, artist, album);
    let response = apple_music_request(client, |access_token| { client
        .get(format!(
            "https://amp-api.music.apple.com/v1/catalog/{}/search",
            storefront.id
        ))
        .query(&[
            ("term", term.as_str()),
            ("types", "songs"),
            ("limit", "10"),
            ("l", storefront.language.as_str()),
        ])
        .header("Accept", "application/json")
        .header(
            "Accept-Language",
            format!("{},en;q=0.9", storefront.language),
        )
        .header("Authorization", format!("Bearer {access_token}"))
        .header("media-user-token", media_user_token)
        .header("Origin", APPLE_MUSIC_ORIGIN)
        .header("Referer", APPLE_MUSIC_REFERER)
        .header("User-Agent", USER_AGENT)
        .send()
        .map_err(classify_provider_request_error)
    }).map_err(provider_request_error_message)?;
    if !response.status().is_success() {
        return Err(format!(
            "Apple Music search request failed: {}",
            response.status()
        ));
    }
    response
        .json()
        .map_err(|error| format!("Apple Music search parse failed: {error}"))
}

fn fetch_apple_music_song(
    client: &reqwest::blocking::Client,
    media_user_token: &str,
    storefront: &AppleMusicStorefront,
    song_id: &str,
) -> Result<Value, String> {
    let response = apple_music_request(client, |access_token| { client
        .get(format!(
            "https://amp-api.music.apple.com/v1/catalog/{}/songs/{song_id}",
            storefront.id
        ))
        .query(&[
            ("include[songs]", "albums,lyrics,syllable-lyrics"),
            ("l", storefront.language.as_str()),
        ])
        .header("Accept", "application/json")
        .header(
            "Accept-Language",
            format!("{},en;q=0.9", storefront.language),
        )
        .header("Authorization", format!("Bearer {access_token}"))
        .header("media-user-token", media_user_token)
        .header("Origin", APPLE_MUSIC_ORIGIN)
        .header("Referer", APPLE_MUSIC_REFERER)
        .header("User-Agent", USER_AGENT)
        .send()
        .map_err(classify_provider_request_error)
    }).map_err(provider_request_error_message)?;
    if response.status().as_u16() == 404 {
        return Ok(Value::Null);
    }
    if !response.status().is_success() {
        return Err(format!(
            "Apple Music song request failed: {}",
            response.status()
        ));
    }
    response
        .json()
        .map_err(|error| format!("Apple Music song parse failed: {error}"))
}

fn apple_music_search_term(title: &str, artist: &str, album: Option<&str>) -> String {
    [Some(title), Some(artist), album]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn select_apple_music_song(
    response: &Value,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> Option<AppleMusicCatalogSong> {
    response
        .pointer("/results/songs/data")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(apple_music_catalog_song_from_value)
        .map(|song| {
            (
                score_apple_music_song(&song, title, artist, album, duration_ms),
                song,
            )
        })
        .max_by_key(|(score, _)| *score)
        .and_then(|(score, song)| (score >= 80).then_some(song))
}

fn apple_music_catalog_song_from_value(value: &Value) -> Option<AppleMusicCatalogSong> {
    let attributes = value.get("attributes")?;
    let genre = attributes
        .get("genreNames")
        .and_then(Value::as_array)
        .and_then(|genres| genres.first())
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    Some(AppleMusicCatalogSong {
        id: value.get("id")?.as_str()?.to_string(),
        name: string_attr(attributes, "name"),
        artist: string_attr(attributes, "artistName"),
        album: string_attr(attributes, "albumName"),
        url: string_attr(attributes, "url"),
        genre,
        duration_ms: attributes.get("durationInMillis").and_then(Value::as_u64),
    })
}

fn string_attr(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn score_apple_music_song(
    song: &AppleMusicCatalogSong,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> i32 {
    let mut score = 0;
    score += text_match_score(song.name.as_deref(), title, 100, 55);
    score += text_match_score(song.artist.as_deref(), artist, 55, 25);
    if let Some(album) = album {
        score += text_match_score(song.album.as_deref(), album, 45, 20);
    }
    if let (Some(candidate), Some(target)) = (song.duration_ms, duration_ms) {
        let delta = candidate.abs_diff(target);
        if delta <= 3000 {
            score += 45;
        } else if delta <= 10_000 {
            score += 20;
        }
    }
    score
}

fn score_itunes_track(
    track: &ItunesSearchTrack,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> i32 {
    if track.wrapper_type.as_deref() != Some("track") || track.kind.as_deref() != Some("song") {
        return 0;
    }

    let mut score = 0;
    score += text_match_score(track.track_name.as_deref(), title, 100, 45);
    score += text_match_score(track.artist_name.as_deref(), artist, 60, 25);
    if let Some(album) = album {
        score += text_match_score(track.collection_name.as_deref(), album, 35, 15);
    }
    if let (Some(candidate), Some(target)) = (track.track_time_millis, duration_ms) {
        let delta = candidate.abs_diff(target);
        if delta <= 3000 {
            score += 40;
        } else if delta <= 10_000 {
            score += 18;
        } else if delta <= 30_000 {
            score += 8;
        }
    }
    score
}

fn itunes_metadata_from_track(track: ItunesSearchTrack, score: i32) -> ItunesGenreMetadata {
    let genre = track
        .primary_genre_name
        .unwrap_or_default()
        .trim()
        .to_string();
    ItunesGenreMetadata {
        genre: genre.clone(),
        genre_hint: genre,
        genre_source: "itunes_search".to_string(),
        genre_confidence: score.clamp(0, 200),
        matched_title: track.track_name,
        matched_artist: track.artist_name,
        matched_album: track.collection_name,
    }
}

fn text_match_score(candidate: Option<&str>, target: &str, exact: i32, contains: i32) -> i32 {
    let Some(candidate) = candidate else {
        return 0;
    };
    let candidate = normalize_match_text(candidate);
    let target = normalize_match_text(target);
    if candidate.is_empty() || target.is_empty() {
        0
    } else if candidate == target {
        exact
    } else if candidate.contains(&target) || target.contains(&candidate) {
        contains
    } else {
        0
    }
}

fn normalize_match_text(value: &str) -> String {
    value
        .chars()
        .flat_map(char::to_lowercase)
        .filter(|char| char.is_alphanumeric())
        .collect()
}

fn itunes_search_countries(requested: Option<&str>) -> Vec<&'static str> {
    let mut countries = Vec::new();
    let requested = requested
        .map(str::trim)
        .filter(|value| value.len() == 2)
        .map(|value| value.to_ascii_uppercase());
    if let Some(requested) = requested {
        if let Some(country) = known_itunes_country(&requested) {
            countries.push(country);
        }
    }
    for country in ["JP", "US", "KR"] {
        if !countries.contains(&country) {
            countries.push(country);
        }
    }
    countries
}

fn known_itunes_country(value: &str) -> Option<&'static str> {
    match value {
        "JP" => Some("JP"),
        "US" => Some("US"),
        "KR" => Some("KR"),
        "CN" => Some("CN"),
        "TW" => Some("TW"),
        "HK" => Some("HK"),
        "GB" => Some("GB"),
        "CA" => Some("CA"),
        "AU" => Some("AU"),
        "DE" => Some("DE"),
        "FR" => Some("FR"),
        "ES" => Some("ES"),
        "IT" => Some("IT"),
        "BR" => Some("BR"),
        "MX" => Some("MX"),
        _ => None,
    }
}

fn itunes_genre_cache_key(
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
    countries: &[&str],
) -> String {
    format!(
        "{}|{}|{}|{}|{}",
        normalize_match_text(title),
        normalize_match_text(artist),
        album.map(normalize_match_text).unwrap_or_default(),
        duration_ms.unwrap_or_default(),
        countries.join(",")
    )
}

fn itunes_genre_cache() -> &'static Mutex<HashMap<String, Option<ItunesGenreMetadata>>> {
    ITUNES_GENRE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cached_itunes_genre(cache_key: &str) -> Option<Option<ItunesGenreMetadata>> {
    itunes_genre_cache().lock().ok()?.get(cache_key).cloned()
}

fn cache_itunes_genre(cache_key: &str, metadata: Option<ItunesGenreMetadata>) {
    if let Ok(mut cache) = itunes_genre_cache().lock() {
        cache.insert(cache_key.to_string(), metadata);
    }
}

fn extract_apple_music_ttml(response: &Value) -> Option<String> {
    let song = response
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())?;
    ["lyrics", "syllable-lyrics"].iter().find_map(|name| {
        song.get("relationships")
            .and_then(|relationships| relationships.get(*name))
            .and_then(|relationship| relationship.get("data"))
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("attributes"))
            .and_then(|attributes| attributes.get("ttml"))
            .and_then(Value::as_str)
            .map(str::to_string)
    })
}

fn parse_apple_music_ttml_lines(ttml: &str) -> Result<Vec<LyricLine>, String> {
    let mut reader = Reader::from_str(ttml);
    reader.config_mut().trim_text(false);

    let mut buf = Vec::new();
    let mut current_line: Option<PendingTtmlLine> = None;
    let mut lines = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(event)) if local_xml_name(event.name().as_ref()) == b"p" => {
                current_line = Some(PendingTtmlLine {
                    begin_ms: attr_ms(&reader, &event, b"begin"),
                    end_ms: attr_ms(&reader, &event, b"end"),
                    ..PendingTtmlLine::default()
                });
            }
            Ok(Event::Start(event)) if local_xml_name(event.name().as_ref()) == b"span" => {
                if let Some(line) = current_line.as_mut() {
                    if let Some(begin_ms) = attr_ms(&reader, &event, b"begin") {
                        line.span_begin_ms = Some(
                            line.span_begin_ms
                                .map_or(begin_ms, |current| current.min(begin_ms)),
                        );
                    }
                    if let Some(end_ms) = attr_ms(&reader, &event, b"end") {
                        line.span_end_ms = Some(
                            line.span_end_ms
                                .map_or(end_ms, |current| current.max(end_ms)),
                        );
                    }
                }
            }
            Ok(Event::Text(event)) => {
                if let Some(line) = current_line.as_mut() {
                    let text = event
                        .decode()
                        .map_err(|error| format!("Apple Music TTML text decode failed: {error}"))?;
                    line.text.push_str(&text);
                }
            }
            Ok(Event::CData(event)) => {
                if let Some(line) = current_line.as_mut() {
                    let text = event.decode().map_err(|error| {
                        format!("Apple Music TTML CDATA decode failed: {error}")
                    })?;
                    line.text.push_str(&text);
                }
            }
            Ok(Event::End(event)) if local_xml_name(event.name().as_ref()) == b"p" => {
                if let Some(line) = current_line.take() {
                    let text = normalize_ttml_text(&line.text);
                    if !text.is_empty() {
                        let start_ms = line.begin_ms.or(line.span_begin_ms).unwrap_or(0);
                        let end_ms = line.end_ms.or(line.span_end_ms).unwrap_or(start_ms);
                        lines.push(LyricLine {
                            index: lines.len(),
                            start_ms,
                            end_ms,
                            timestamp: format_timestamp(start_ms),
                            text,
                        });
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("Apple Music TTML parse failed: {error}")),
            _ => {}
        }
        buf.clear();
    }

    fill_missing_apple_music_line_end_times(&mut lines);
    Ok(lines)
}

fn fill_missing_apple_music_line_end_times(lines: &mut [LyricLine]) {
    // Untimed lyrics must stay untimed: synthetic ends would mark them as synced.
    if !lines
        .iter()
        .any(|line| line.start_ms > 0 || line.end_ms > line.start_ms)
    {
        return;
    }

    for index in 0..lines.len() {
        if lines[index].end_ms > lines[index].start_ms {
            continue;
        }
        lines[index].end_ms = lines
            .get(index + 1)
            .map(|next| next.start_ms)
            .filter(|next_start| *next_start > lines[index].start_ms)
            .unwrap_or_else(|| lines[index].start_ms.saturating_add(2000));
    }
}

fn attr_ms(reader: &Reader<&[u8]>, event: &BytesStart<'_>, name: &[u8]) -> Option<u64> {
    event.attributes().filter_map(Result::ok).find_map(|attr| {
        (local_xml_name(attr.key.as_ref()) == name)
            .then(|| attr.decode_and_unescape_value(reader.decoder()).ok())
            .flatten()
            .and_then(|value| parse_ttml_timestamp_ms(&value))
    })
}

fn local_xml_name(name: &[u8]) -> &[u8] {
    name.rsplit(|byte| *byte == b':').next().unwrap_or(name)
}

fn parse_ttml_timestamp_ms(value: &str) -> Option<u64> {
    let value = value.trim().trim_end_matches('s');
    if value.is_empty() {
        return None;
    }
    let seconds = value.split(':').try_fold(0.0, |total, part| {
        part.parse::<f64>().ok().map(|value| total * 60.0 + value)
    })?;
    Some((seconds * 1000.0).round().max(0.0) as u64)
}

fn normalize_ttml_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn metadata_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(METADATA_TIMEOUT_SECONDS))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

pub(crate) fn get_spotify_token() -> Result<String, String> {
    let sp_dc = secrets::load_sp_dc()?.ok_or_else(|| {
        "Spotify SP_DC is missing. Save it in Keychain or set SP_DC before launching SongDocent."
            .to_string()
    })?;
    let now_ms = unix_ms();
    if let Ok(cache) = spotify_access_token_cache().lock() {
        if let Some(access_token) = cache.get(&sp_dc, now_ms) {
            return Ok(access_token);
        }
    }

    let (status, data) =
        request_spotify_token_response(&sp_dc).map_err(provider_request_error_message)?;
    if !(200..300).contains(&status) {
        return Err(format!("Spotify token request failed: {status}"));
    }
    let data = data.ok_or_else(|| "Spotify token missing in response".to_string())?;
    let access_token = extract_spotify_access_token(&data)
        .ok_or_else(|| "Spotify token missing in response".to_string())?;
    let expires_at_ms = spotify_token_expiry_ms(&data, now_ms);
    if let Ok(mut cache) = spotify_access_token_cache().lock() {
        cache.store(&sp_dc, &access_token, expires_at_ms);
    }
    Ok(access_token)
}

fn spotify_access_token_cache() -> &'static Mutex<SpotifyTokenCache> {
    SPOTIFY_ACCESS_TOKEN_CACHE.get_or_init(|| Mutex::new(SpotifyTokenCache::default()))
}

fn spotify_token_expiry_ms(data: &Value, now_ms: u64) -> u64 {
    data.get("accessTokenExpirationTimestampMs")
        .and_then(Value::as_u64)
        .filter(|expires_at_ms| *expires_at_ms > now_ms)
        .unwrap_or_else(|| now_ms.saturating_add(SPOTIFY_TOKEN_FALLBACK_TTL_MS))
}

pub(crate) fn request_spotify_token_response(
    sp_dc: &str,
) -> Result<(u16, Option<Value>), ProviderRequestError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(classify_provider_request_error)?;
    request_spotify_token_response_with_client(&client, sp_dc)
}

pub(crate) fn request_spotify_token_response_with_client(
    client: &reqwest::blocking::Client,
    sp_dc: &str,
) -> Result<(u16, Option<Value>), ProviderRequestError> {
    let (secret, version) =
        initialize_totp_secret(client).map_err(|_| ProviderRequestError::InvalidResponse)?;
    let local_time = unix_ms();
    let server_time = spotify_server_time(&client, sp_dc).unwrap_or(local_time);
    let totp_local = generate_totp(&secret, local_time);
    let totp_server = generate_totp(&secret, server_time / 30);

    let response = client
        .get("https://open.spotify.com/api/token")
        .query(&[
            ("reason", "init"),
            ("productType", "mobile-web-player"),
            ("totp", totp_local.as_str()),
            ("totpVer", version.as_str()),
            ("totpServer", totp_server.as_str()),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Origin", "https://open.spotify.com/")
        .header("Referer", "https://open.spotify.com/")
        .header("Cookie", format!("sp_dc={sp_dc}"))
        .send()
        .map_err(classify_provider_request_error)?;

    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Ok((status, None));
    }

    let data: Value = response
        .json()
        .map_err(|_| ProviderRequestError::InvalidResponse)?;
    Ok((status, Some(data)))
}

pub(crate) fn parse_spotify_token_response(data: &Value) -> Result<String, SpotifyTokenParseError> {
    let access_token =
        extract_spotify_access_token(data).ok_or(SpotifyTokenParseError::InvalidShape)?;
    match data.get("isAnonymous").and_then(Value::as_bool) {
        Some(false) => Ok(access_token),
        Some(true) => Err(SpotifyTokenParseError::Anonymous),
        None => Err(SpotifyTokenParseError::InvalidShape),
    }
}

fn extract_spotify_access_token(data: &Value) -> Option<String> {
    data.get("accessToken")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(str::to_string)
}

fn classify_provider_request_error(error: reqwest::Error) -> ProviderRequestError {
    if error.is_builder() {
        ProviderRequestError::InvalidInput
    } else if error.is_timeout() {
        ProviderRequestError::Timeout
    } else {
        ProviderRequestError::Network
    }
}

fn provider_request_error_message(error: ProviderRequestError) -> String {
    match error {
        ProviderRequestError::Timeout => "Provider request timed out".to_string(),
        ProviderRequestError::Network => "Provider network request failed".to_string(),
        ProviderRequestError::Http(status) => {
            format!("Provider request failed with HTTP status {status}")
        }
        ProviderRequestError::InvalidResponse => "Provider response parse failed".to_string(),
        ProviderRequestError::InvalidInput => "Provider request input is invalid".to_string(),
    }
}

fn initialize_totp_secret(client: &reqwest::blocking::Client) -> Result<(Vec<u8>, String), String> {
    let fetched = client
        .get(SECRETS_URL)
        .header("User-Agent", USER_AGENT)
        .send()
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.json::<HashMap<String, Vec<u8>>>());

    let secrets = fetched.unwrap_or_else(|_| {
        HashMap::from([(
            "19".to_string(),
            vec![
                99, 111, 47, 88, 49, 56, 118, 65, 52, 67, 50, 104, 117, 101, 55, 94, 95, 75, 94,
                49, 69, 36, 85, 64, 74, 60,
            ],
        )])
    });

    let version = secrets
        .keys()
        .filter_map(|key| key.parse::<u32>().ok())
        .max()
        .map(|value| value.to_string())
        .ok_or_else(|| "No Spotify TOTP secret version found".to_string())?;
    let data = secrets
        .get(&version)
        .ok_or_else(|| "Spotify TOTP secret data missing".to_string())?;
    Ok((create_totp_secret(data), version))
}

fn create_totp_secret(data: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(index, value)| (value ^ (((index % 33) + 9) as u8)).to_string())
        .collect::<String>()
        .into_bytes()
}

fn spotify_server_time(client: &reqwest::blocking::Client, sp_dc: &str) -> Result<u64, String> {
    let response = client
        .get("https://open.spotify.com/api/server-time")
        .header("User-Agent", USER_AGENT)
        .header("Origin", "https://open.spotify.com/")
        .header("Referer", "https://open.spotify.com/")
        .header("Cookie", format!("sp_dc={sp_dc}"))
        .send()
        .map_err(|error| format!("Spotify server-time request failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Spotify server-time request failed: {}",
            response.status()
        ));
    }
    let data: Value = response
        .json()
        .map_err(|error| format!("Spotify server-time response parse failed: {error}"))?;
    data.get("serverTime")
        .and_then(Value::as_u64)
        .map(|seconds| seconds * 1000)
        .ok_or_else(|| "Spotify server-time missing".to_string())
}

fn generate_totp(secret: &[u8], timestamp_ms: u64) -> String {
    let counter = timestamp_ms / 30_000;
    let mut mac = HmacSha1::new_from_slice(secret).expect("HMAC supports any key length");
    mac.update(&counter.to_be_bytes());
    let hash = mac.finalize().into_bytes();
    let offset = (hash[hash.len() - 1] & 0x0f) as usize;
    let code = (((hash[offset] as u32) & 0x7f) << 24)
        | ((hash[offset + 1] as u32) << 16)
        | ((hash[offset + 2] as u32) << 8)
        | (hash[offset + 3] as u32);
    format!("{:06}", code % 1_000_000)
}

fn normalize_lines(raw_lines: Vec<RawLyricLine>) -> Vec<LyricLine> {
    raw_lines
        .iter()
        .enumerate()
        .map(|(index, line)| {
            let start_ms = line.start_time_ms.parse::<u64>().unwrap_or(0);
            let end_ms = line
                .end_time_ms
                .as_deref()
                .filter(|value| *value != "0")
                .and_then(|value| value.parse::<u64>().ok())
                .or_else(|| {
                    raw_lines
                        .get(index + 1)
                        .and_then(|next| next.start_time_ms.parse::<u64>().ok())
                })
                .unwrap_or(start_ms + 2000);

            LyricLine {
                index,
                start_ms,
                end_ms,
                timestamp: format_timestamp(start_ms),
                text: line.words.clone().unwrap_or_default().trim().to_string(),
            }
        })
        .collect()
}

fn format_timestamp(ms: u64) -> String {
    let total_seconds = ms as f64 / 1000.0;
    let minutes = (total_seconds / 60.0).floor() as u64;
    let mut seconds = (total_seconds as u64) % 60;
    let mut centiseconds = ((total_seconds - total_seconds.floor()) * 100.0).round() as u64;
    let mut minutes = minutes;
    if centiseconds >= 100 {
        centiseconds = 0;
        seconds += 1;
        if seconds >= 60 {
            seconds = 0;
            minutes += 1;
        }
    }
    format!("{minutes:02}:{seconds:02}.{centiseconds:02}")
}

fn extract_track_id(track_id_or_url: &str) -> String {
    track_id_or_url
        .trim()
        .trim_start_matches("https://open.spotify.com/track/")
        .trim_start_matches("spotify:track:")
        .split('?')
        .next()
        .unwrap_or("")
        .to_string()
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apple_music_runtime_requests_refresh_rejected_tokens_once() {
        for initial_status in [401, 403, 200, 404, 429, 503] {
            let tokens = std::cell::Cell::new(0);
            let invalidations = std::cell::Cell::new(0);
            let requested_tokens = std::cell::RefCell::new(Vec::new());
            let result = retry_apple_music_with_fresh_developer_token(
                || { tokens.set(tokens.get() + 1); Ok::<_, String>(format!("token-{}", tokens.get())) },
                |token| {
                    requested_tokens.borrow_mut().push(token.to_string());
                    Ok(if token == "token-1" { initial_status } else { 200 })
                },
                |status| *status,
                || invalidations.set(invalidations.get() + 1),
            ).unwrap();
            if matches!(initial_status, 401 | 403) {
                assert_eq!(result, 200);
                assert_eq!(tokens.get(), 2);
                assert_eq!(invalidations.get(), 1);
                assert_eq!(*requested_tokens.borrow(), vec!["token-1", "token-2"]);
            } else {
                assert_eq!(result, initial_status);
                assert_eq!(tokens.get(), 1);
                assert_eq!(invalidations.get(), 0);
            }
        }
    }

    #[test]
    fn apple_music_runtime_retry_preserves_second_auth_failure_and_refresh_errors() {
        let requests = std::cell::Cell::new(0);
        let result = retry_apple_music_with_fresh_developer_token(
            || Ok::<_, String>("token".into()),
            |_| { requests.set(requests.get() + 1); Ok(401) },
            |status| *status, || {},
        ).unwrap();
        assert_eq!(result, 401);
        assert_eq!(requests.get(), 2);
        let fetches = std::cell::Cell::new(0);
        let result = retry_apple_music_with_fresh_developer_token(
            || {
                fetches.set(fetches.get() + 1);
                if fetches.get() == 1 { Ok("stale".into()) } else { Err("refresh unavailable") }
            },
            |_| Ok(403), |status| *status, || {},
        );
        assert_eq!(result, Err("refresh unavailable"));
    }
    use serde_json::json;
    use std::future::Future;

    #[test]
    fn startup_lyrics_commands_return_futures() {
        fn assert_spotify_command<F, Fut>(_command: F)
        where
            F: FnOnce(String, Option<String>, Option<String>) -> Fut,
            Fut: Future<Output = Result<Option<LyricsPayload>, AppError>>,
        {
        }
        fn assert_apple_music_command<F, Fut>(_command: F)
        where
            F: FnOnce(
                Option<String>,
                String,
                String,
                Option<String>,
                Option<u64>,
                Option<String>,
            ) -> Fut,
            Fut: Future<Output = Result<Option<LyricsPayload>, AppError>>,
        {
        }

        assert_spotify_command(get_spotify_lyrics);
        assert_apple_music_command(get_apple_music_lyrics);
    }

    #[test]
    fn extracts_track_id_from_spotify_url_with_query() {
        assert_eq!(
            extract_track_id(
                "https://open.spotify.com/track/5SkRLpaGtvYPhw02vZhQQ9?si=30ab764b05c5436b"
            ),
            "5SkRLpaGtvYPhw02vZhQQ9"
        );
    }

    #[test]
    fn parses_non_anonymous_spotify_access_token() {
        let response = json!({
            "accessToken": "spotify-access-token",
            "isAnonymous": false
        });

        assert_eq!(
            parse_spotify_token_response(&response),
            Ok("spotify-access-token".to_string())
        );
    }

    #[test]
    fn rejects_anonymous_spotify_access_token() {
        let response = json!({
            "accessToken": "anonymous-access-token",
            "isAnonymous": true
        });

        assert_eq!(
            parse_spotify_token_response(&response),
            Err(SpotifyTokenParseError::Anonymous)
        );
    }

    #[test]
    fn runtime_spotify_token_parser_keeps_anonymous_access_token_compatibility() {
        let response = json!({
            "accessToken": "anonymous-access-token",
            "isAnonymous": true
        });

        assert_eq!(
            extract_spotify_access_token(&response),
            Some("anonymous-access-token".to_string())
        );
    }

    #[test]
    fn spotify_token_cache_reuses_only_current_unexpired_credentials() {
        let mut cache = SpotifyTokenCache::default();
        cache.store("cookie-a", "token-a", 1_000_000);

        assert_eq!(cache.get("cookie-a", 100_000).as_deref(), Some("token-a"));
        assert_eq!(cache.get("cookie-b", 100_000), None);
        assert_eq!(cache.get("cookie-a", 950_000), None);
    }

    #[test]
    fn spotify_token_expiry_uses_payload_with_a_bounded_fallback() {
        let now_ms = 1_000_000;
        assert_eq!(
            spotify_token_expiry_ms(
                &json!({ "accessTokenExpirationTimestampMs": 2_000_000 }),
                now_ms,
            ),
            2_000_000
        );
        assert_eq!(
            spotify_token_expiry_ms(&json!({}), now_ms),
            now_ms + SPOTIFY_TOKEN_FALLBACK_TTL_MS
        );
    }

    #[test]
    fn spotify_bootstrap_helpers_require_a_configured_client() {
        let _: fn(
            &reqwest::blocking::Client,
            &str,
        ) -> Result<(u16, Option<Value>), ProviderRequestError> =
            request_spotify_token_response_with_client;
        let _: fn(&reqwest::blocking::Client) -> Result<(Vec<u8>, String), String> =
            initialize_totp_secret;
    }

    #[test]
    fn apple_bootstrap_helpers_return_typed_errors() {
        let _: fn() -> Result<reqwest::blocking::Client, ProviderRequestError> = apple_music_client;
        let _: fn(&reqwest::blocking::Client) -> Result<String, ProviderRequestError> =
            get_apple_music_access_token;
    }

    #[test]
    fn invalid_header_values_are_classified_as_invalid_input() {
        let error = reqwest::blocking::Client::new()
            .get("https://example.com")
            .header("x-test", "invalid\nheader")
            .build()
            .expect_err("header must be rejected");

        assert_eq!(
            classify_provider_request_error(error),
            ProviderRequestError::InvalidInput
        );
    }

    #[test]
    fn rejects_spotify_response_without_access_token() {
        let response = json!({ "isAnonymous": false });

        assert_eq!(
            parse_spotify_token_response(&response),
            Err(SpotifyTokenParseError::InvalidShape)
        );
    }

    #[test]
    fn scores_itunes_track_by_title_artist_album_and_duration() {
        let candidate = ItunesSearchTrack {
            wrapper_type: Some("track".to_string()),
            kind: Some("song".to_string()),
            artist_name: Some("aiko".to_string()),
            collection_name: Some("湿った夏の始まり".to_string()),
            track_name: Some("ストロー".to_string()),
            primary_genre_name: Some("J-Pop".to_string()),
            track_time_millis: Some(294_938),
        };

        assert!(
            score_itunes_track(
                &candidate,
                "ストロー",
                "aiko",
                Some("湿った夏の始まり"),
                Some(294_938),
            ) >= 200
        );
    }

    #[test]
    fn builds_itunes_genre_metadata_from_primary_genre_name() {
        let candidate = ItunesSearchTrack {
            wrapper_type: Some("track".to_string()),
            kind: Some("song".to_string()),
            artist_name: Some("aiko".to_string()),
            collection_name: Some("湿った夏の始まり".to_string()),
            track_name: Some("ストロー".to_string()),
            primary_genre_name: Some("J-Pop".to_string()),
            track_time_millis: Some(294_938),
        };

        let metadata = itunes_metadata_from_track(candidate, 200);

        assert_eq!(metadata.genre, "J-Pop");
        assert_eq!(metadata.genre_hint, "J-Pop");
        assert_eq!(metadata.genre_source, "itunes_search");
        assert_eq!(metadata.genre_confidence, 200);
        assert_eq!(metadata.matched_artist.as_deref(), Some("aiko"));
    }

    #[test]
    fn extracts_apple_music_access_token_from_web_player_js() {
        let script = r#"window.__amp="before";const token="eyJhbGciOiJSUzI1Ni.fake.token";"#;

        assert_eq!(
            extract_apple_music_access_token(script),
            Some("eyJhbGciOiJSUzI1Ni.fake.token".to_string())
        );
    }

    #[test]
    fn extracts_apple_music_access_token_with_non_alg_header_first() {
        let script =
            r#"window.__amp="before";const token="eyJraWQiOiJBSUQ1LmZha2UifQ.fake.token";"#;

        assert_eq!(
            extract_apple_music_access_token(script),
            Some("eyJraWQiOiJBSUQ1LmZha2UifQ.fake.token".to_string())
        );
    }

    #[test]
    fn selects_best_apple_music_song_by_title_artist_album_and_duration() {
        let response = json!({
            "results": {
                "songs": {
                    "data": [
                        {
                            "id": "wrong-live",
                            "attributes": {
                                "name": "Die With A Smile (Live)",
                                "artistName": "Lady Gaga",
                                "albumName": "Live Sessions",
                                "durationInMillis": 300000,
                                "url": "https://music.apple.com/us/song/wrong-live/1"
                            }
                        },
                        {
                            "id": "catalog-good",
                            "attributes": {
                                "name": "Die With A Smile",
                                "artistName": "Lady Gaga & Bruno Mars",
                                "albumName": "Die With A Smile - Single",
                                "durationInMillis": 251714,
                                "url": "https://music.apple.com/us/song/die-with-a-smile/2"
                            }
                        }
                    ]
                }
            }
        });

        let match_result = select_apple_music_song(
            &response,
            "Die With A Smile",
            "レディー・ガガ & ブルーノ・マーズ",
            Some("Die With A Smile - Single"),
            Some(251_715),
        )
        .expect("catalog match should be selected");

        assert_eq!(match_result.id, "catalog-good");
        assert_eq!(
            match_result.url.as_deref(),
            Some("https://music.apple.com/us/song/die-with-a-smile/2")
        );
    }

    #[test]
    fn keeps_untimed_apple_music_ttml_unsynced() {
        for timing in ["", " begin=\"00:00.00\" end=\"00:00.00\""] {
            let ttml = format!(
                "<tt><body><div><p{timing}>First line</p><p{timing}>Last line</p></div></body></tt>"
            );
            let lines = parse_apple_music_ttml_lines(&ttml).expect("untimed ttml should parse");

            assert_eq!(lines.len(), 2);
            assert_eq!(lines[0].text, "First line");
            assert_eq!(lines[1].text, "Last line");
            assert!(lines
                .iter()
                .all(|line| line.start_ms == 0 && line.end_ms == 0));
        }
    }

    #[test]
    fn fills_missing_apple_music_end_times_for_timed_lyrics() {
        let ttml = r#"<tt><body><div>
            <p begin="00:00.00">First line</p>
            <p begin="00:03.00">Last line</p>
        </div></body></tt>"#;
        let lines = parse_apple_music_ttml_lines(ttml).expect("timed ttml should parse");

        assert_eq!(lines[0].start_ms, 0);
        assert_eq!(lines[0].end_ms, 3000);
        assert_eq!(lines[1].start_ms, 3000);
        assert_eq!(lines[1].end_ms, 5000);
    }

    #[test]
    fn parses_apple_music_ttml_into_synced_lines() {
        let ttml = r#"
            <tt xmlns:itunes="http://itunes.apple.com/lyric-ttml-internal" itunes:timing="Line">
              <body>
                <div>
                  <p begin="00:01.00" end="00:03.50">Hello songdocent</p>
                  <p begin="00:03.50" end="00:05.00">Glow again</p>
                </div>
              </body>
            </tt>
        "#;

        let lines = parse_apple_music_ttml_lines(ttml).expect("ttml should parse");

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].index, 0);
        assert_eq!(lines[0].start_ms, 1000);
        assert_eq!(lines[0].end_ms, 3500);
        assert_eq!(lines[0].timestamp, "00:01.00");
        assert_eq!(lines[0].text, "Hello songdocent");
        assert_eq!(lines[1].start_ms, 3500);
        assert_eq!(lines[1].end_ms, 5000);
        assert_eq!(lines[1].text, "Glow again");
    }

    #[test]
    fn parses_apple_music_ttml_span_timing_as_line_fallback() {
        let ttml = r#"
            <tt xmlns:itunes="http://itunes.apple.com/lyric-ttml-internal" itunes:timing="Word">
              <body>
                <div>
                  <p>
                    <span begin="00:10.00" end="00:10.50">Hold </span>
                    <span begin="00:10.50" end="00:11.20">on</span>
                  </p>
                </div>
              </body>
            </tt>
        "#;

        let lines = parse_apple_music_ttml_lines(ttml).expect("span-timed ttml should parse");

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].start_ms, 10_000);
        assert_eq!(lines[0].end_ms, 11_200);
        assert_eq!(lines[0].text, "Hold on");
    }
}
