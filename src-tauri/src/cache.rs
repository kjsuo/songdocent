use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::annotation::normalize_annotation_text;
use crate::app_error::{AppError, ErrorDomain};

// Reads can migrate the file too, so every transaction shares this lock.
static CACHE_LOCK: Mutex<()> = Mutex::new(());

fn lock_cache() -> Result<MutexGuard<'static, ()>, String> {
    CACHE_LOCK.lock().map_err(|_| "Cache storage lock is unavailable.".to_string())
}

#[cfg(test)]
pub(crate) static TEST_CACHE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(Debug, Default, Serialize, Deserialize)]
struct CacheDb {
    version: u32,
    tracks: HashMap<String, TrackCache>,
    #[serde(default)]
    spotify_track_resolutions: HashMap<String, Option<String>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct TrackCache {
    translations: HashMap<String, TranslationCache>,
    updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranslationCache {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    grounding: Option<Value>,
    source_fingerprint: String,
    lines: Vec<CachedTranslationLine>,
    updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedTranslationLine {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    grounding: Option<Value>,
    id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    translation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    annotation: Option<String>,
}

#[tauri::command]
pub async fn apply_translation_cache(
    track_id: String,
    target_lang: String,
    payload: Value,
) -> Result<Value, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        apply_translation_cache_blocking(track_id, target_lang, payload)
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Storage,
            "Cache apply task failed",
            error.to_string(),
        )
    })?;

    result.map_err(AppError::storage)
}

#[tauri::command]
pub async fn save_translation_cache(
    track_id: String,
    target_lang: String,
    payload: Value,
) -> Result<(), AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        save_translation_cache_blocking(track_id, target_lang, payload)
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Storage,
            "Cache save task failed",
            error.to_string(),
        )
    })?;

    result.map_err(AppError::storage)
}

#[tauri::command]
pub async fn clear_translation_cache(
    track_id: String,
    target_lang: String,
) -> Result<(), AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_cache()?;
        let key = normalize_track_key(&track_id);
        let target_lang = normalize_lang(&target_lang);
        let mut db = load_db()?;
        if let Some(record) = db.tracks.get_mut(&key) {
            record.translations.retain(|scope, _| scope != &target_lang && !scope.starts_with(&format!("{target_lang}:")));
            record.updated_at = unix_ms();
            save_db(&db)?;
        }
        Ok(())
    })
    .await
    .map_err(|error| {
        AppError::task(
            ErrorDomain::Storage,
            "Cache clear task failed",
            error.to_string(),
        )
    })?;

    result.map_err(AppError::storage)
}

fn apply_translation_cache_blocking(
    track_id: String,
    target_lang: String,
    payload: Value,
) -> Result<Value, String> {
    let key = normalize_track_key(&track_id);
    let target_lang = normalize_lang(&target_lang);
    if key.is_empty() {
        return Ok(mark_untranslated(payload, &target_lang));
    }

    let fingerprint = source_fingerprint(&payload);
    let _guard = lock_cache()?;
    let db = load_db()?;
    let Some(record) = db.tracks.get(&key) else {
        return Ok(mark_untranslated(payload, &target_lang));
    };
    let Some(translation) = record.translations.get(&target_lang) else {
        return Ok(mark_untranslated(payload, &target_lang));
    };
    if translation.source_fingerprint != fingerprint {
        return Ok(mark_untranslated(payload, &target_lang));
    }

    let mut payload = apply_cached_lines(payload, &target_lang, &translation.lines);
    if let Some(grounding) = &translation.grounding { payload["translation_grounding"] = grounding.clone(); }
    Ok(payload)
}

fn save_translation_cache_blocking(
    track_id: String,
    target_lang: String,
    payload: Value,
) -> Result<(), String> {
    let key = normalize_track_key(&track_id);
    if key.is_empty() {
        return Err("track_id is required".to_string());
    }
    let target_lang = normalize_lang(&target_lang);
    let lines = extract_cached_lines(&payload, &target_lang);
    if lines.is_empty() {
        return Err("No translated lines or annotations to cache.".to_string());
    }

    let now = unix_ms();
    let _guard = lock_cache()?;
    let mut db = load_db()?;
    let track = db.tracks.entry(key).or_default();
    track.translations.insert(
        target_lang.clone(),
        TranslationCache {
            grounding: payload.get("translation_grounding").cloned(),
            source_fingerprint: source_fingerprint(&payload),
            lines,
            updated_at: now,
        },
    );
    track.updated_at = now;
    save_db(&db)
}

pub(crate) fn load_spotify_track_resolutions() -> Result<HashMap<String, Option<String>>, String> {
    let _guard = lock_cache()?;
    load_db().map(|db| db.spotify_track_resolutions)
}

pub(crate) fn save_spotify_track_resolutions(
    entries: &HashMap<String, Option<String>>,
) -> Result<(), String> {
    let _guard = lock_cache()?;
    let mut db = load_db()?;
    db.spotify_track_resolutions = entries.clone();
    save_db(&db)
}

fn load_db() -> Result<CacheDb, String> {
    let path = cache_path()?;
    if !path.exists() {
        return Ok(CacheDb {
            version: 1,
            tracks: HashMap::new(),
            spotify_track_resolutions: HashMap::new(),
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read cache file {}: {error}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(empty_db());
    }

    let data: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(_) => {
            let _ = fs::remove_file(&path);
            return Ok(empty_db());
        }
    };
    if contains_legacy_source_cache(&data) {
        let _ = fs::remove_file(&path);
        return Ok(empty_db());
    }

    let mut db: CacheDb = serde_json::from_value(data).or_else(|_| {
        let _ = fs::remove_file(&path);
        Ok::<CacheDb, String>(empty_db())
    })?;
    if merge_search_mode_caches(&mut db) { save_db(&db)?; }
    Ok(db)
}

fn merge_search_mode_caches(db: &mut CacheDb) -> bool {
    let mut changed = false;
    for record in db.tracks.values_mut() {
        let old = std::mem::take(&mut record.translations);
        for (scope, translation) in old {
            let lang = match scope.rsplit_once(':') {
                Some((lang, "translation" | "annotation")) => { changed = true; lang.to_string() },
                _ => scope,
            };
            let replace = record.translations.get(&lang).map_or(true, |current| translation.updated_at > current.updated_at);
            if replace { record.translations.insert(lang, translation); }
        }
    }
    changed
}

fn save_db(db: &CacheDb) -> Result<(), String> {
    let path = cache_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create cache directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let content = serde_json::to_string_pretty(db)
        .map_err(|error| format!("Failed to serialize cache: {error}"))?;
    let parent = path.parent().ok_or_else(|| "Cache directory is missing.".to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("Failed to create temporary cache file: {error}"))?;
    temporary.write_all(content.as_bytes())
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|error| format!("Failed to write cache file {}: {error}", path.display()))?;
    temporary.persist(&path)
        .map_err(|error| format!("Failed to replace cache file {}: {error}", path.display()))?;
    Ok(())
}

pub(crate) fn cache_path() -> Result<PathBuf, String> {
    #[cfg(test)]
    if let Ok(path) = std::env::var("SONGDOCENT_TEST_CACHE_PATH") {
        return Ok(PathBuf::from(path));
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME is not set.".to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("SongDocent")
            .join("lyrics-cache.json"));
    }

    #[cfg(target_os = "windows")]
    {
        let local_app_data =
            std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is not set.".to_string())?;
        return windows_cache_path_from(Some(&local_app_data))
            .ok_or_else(|| "LOCALAPPDATA is empty.".to_string());
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let base = std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|home| PathBuf::from(home).join(".local").join("share"))
            });
        let Some(base) = base else {
            return Err("No data directory environment variable is set.".to_string());
        };
        Ok(base.join("SongDocent").join("lyrics-cache.json"))
    }
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn windows_cache_path_from(local_app_data: Option<&str>) -> Option<PathBuf> {
    local_app_data
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(|base| base.join("SongDocent").join("lyrics-cache.json"))
}

fn apply_cached_lines(
    mut payload: Value,
    target_lang: &str,
    cached_lines: &[CachedTranslationLine],
) -> Value {
    let translations = cached_lines
        .iter()
        .map(|line| (line.id.clone(), line))
        .collect::<HashMap<_, _>>();

    if let Some(lines) = payload.get_mut("lines").and_then(Value::as_array_mut) {
        for (index, line) in lines.iter_mut().enumerate() {
            let id = line_id(line, index);
            let Some(cached_line) = translations.get(&id) else {
                continue;
            };
            let Some(object) = line.as_object_mut() else {
                continue;
            };

            if let Some(translation) = &cached_line.translation {
                object.insert(
                    target_lang.to_string(),
                    Value::String(translation.clone()),
                );
            }
            if let Some(annotation) = cached_line
                .annotation
                .as_deref()
                .and_then(normalize_annotation_text)
            {
                object.insert("annotation".to_string(), Value::String(annotation));
            } else {
                object.remove("annotation");
            }
            object.remove("annotation_grounding");
            if let Some(grounding) = &cached_line.grounding { object.insert("annotation_grounding".into(), grounding.clone()); }
        }
    }

    let has_translation = payload
        .get("lines")
        .and_then(Value::as_array)
        .is_some_and(|lines| lines.iter().any(|line| {
            line.get(target_lang)
                .and_then(Value::as_str)
                .is_some_and(|text| !text.trim().is_empty())
        }));
    if let Some(object) = payload.as_object_mut() {
        object.remove("translation_grounding");
        object.insert("has_translation".to_string(), Value::Bool(has_translation));
        if has_translation {
            object.insert(
                "target_lang".to_string(),
                Value::String(target_lang.to_string()),
            );
        } else {
            object.remove("target_lang");
        }
    }
    payload
}

fn extract_cached_lines(payload: &Value, target_lang: &str) -> Vec<CachedTranslationLine> {
    let Some(lines) = payload.get("lines").and_then(Value::as_array) else {
        return Vec::new();
    };

    lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| {
            let translation = line
                .get(target_lang)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            let annotation = line
                .get("annotation")
                .and_then(Value::as_str)
                .and_then(normalize_annotation_text);
            if translation.is_none() && annotation.is_none() {
                return None;
            }

            Some(CachedTranslationLine {
                grounding: line.get("annotation_grounding").cloned(),
                id: line_id(line, index),
                translation,
                annotation,
            })
        })
        .collect()
}

fn mark_untranslated(mut payload: Value, target_lang: &str) -> Value {
    if let Some(lines) = payload.get_mut("lines").and_then(Value::as_array_mut) {
        for line in lines {
            if let Some(object) = line.as_object_mut() {
                object.remove(target_lang);
                if target_lang == "ko" {
                    object.remove("ko");
                }
                object.remove("annotation");
                object.remove("annotation_grounding");
            }
        }
    }
    if let Some(object) = payload.as_object_mut() {
        object.remove("translation_grounding");
        object.insert("has_translation".to_string(), Value::Bool(false));
        object.remove("target_lang");
    }
    payload
}

fn source_fingerprint(payload: &Value) -> String {
    let mut hasher = Sha1::new();
    if let Some(lines) = payload.get("lines").and_then(Value::as_array) {
        for (index, line) in lines.iter().enumerate() {
            hasher.update(line_id(line, index).as_bytes());
            hasher.update([0]);
            if let Some(start_ms) = line.get("start_ms").or_else(|| line.get("startTimeMs")) {
                hasher.update(start_ms.to_string().as_bytes());
            }
            hasher.update([0]);
            if let Some(text) = line
                .get("text")
                .or_else(|| line.get("en"))
                .and_then(Value::as_str)
            {
                hasher.update(text.as_bytes());
            }
            hasher.update([31]);
        }
    }
    format!("{:x}", hasher.finalize())
}

fn contains_legacy_source_cache(data: &Value) -> bool {
    data.get("tracks")
        .and_then(Value::as_object)
        .map(|tracks| {
            tracks
                .values()
                .any(|record| record.get("payload_raw").is_some())
        })
        .unwrap_or(false)
}

fn empty_db() -> CacheDb {
    CacheDb {
        version: 1,
        tracks: HashMap::new(),
        spotify_track_resolutions: HashMap::new(),
    }
}

fn line_id(line: &Value, position: usize) -> String {
    line.get("index")
        .and_then(value_to_id)
        .unwrap_or_else(|| position.to_string())
}

fn value_to_id(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        let text = text.trim();
        return (!text.is_empty()).then(|| text.to_string());
    }
    if let Some(number) = value.as_u64() {
        return Some(number.to_string());
    }
    if let Some(number) = value.as_i64() {
        return Some(number.to_string());
    }
    None
}

fn normalize_track_key(track_id_or_url: &str) -> String {
    track_id_or_url
        .trim()
        .trim_start_matches("https://open.spotify.com/track/")
        .trim_start_matches("spotify:track:")
        .split('?')
        .next()
        .unwrap_or("")
        .to_string()
}

fn normalize_lang(target_lang: &str) -> String {
    let value = target_lang.trim().to_lowercase();
    if value.is_empty() {
        "ko".to_string()
    } else {
        value
    }
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
    use serde_json::json;
    use std::fs;

    #[test]
    fn concurrent_translation_and_resolver_saves_preserve_every_record() {
        let _guard = TEST_CACHE_LOCK.lock().expect("test cache lock");
        let directory = tempfile::tempdir().unwrap();
        let cache_file = directory.path().join("cache.json");
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(17));
        let mut workers = Vec::new();
        for index in 0..16 {
            let barrier = barrier.clone();
            workers.push(std::thread::spawn(move || {
                barrier.wait();
                save_translation_cache_blocking(
                    format!("track-{index}"), "ko".into(),
                    json!({"lines": [{"index": 0, "text": "Original", "ko": "Translation".repeat(1000)}]}),
                ).unwrap();
            }));
        }
        let resolver_barrier = barrier.clone();
        workers.push(std::thread::spawn(move || {
            resolver_barrier.wait();
            save_spotify_track_resolutions(&HashMap::from([("resolved".into(), Some("id".into()))])).unwrap();
        }));
        for worker in workers { worker.join().unwrap(); }
        let db = load_db().unwrap();
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
        assert_eq!(db.tracks.len(), 16);
        assert_eq!(db.spotify_track_resolutions.get("resolved"), Some(&Some("id".into())));
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn spotify_track_resolutions_round_trip_through_the_shared_cache_file() {
        let _guard = TEST_CACHE_LOCK.lock().expect("test cache lock");
        let cache_file = std::env::temp_dir().join(format!(
            "songdocent-spotify-resolution-cache-test-{}-{}.json",
            std::process::id(),
            unix_ms()
        ));
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);
        let entries = HashMap::from([
            (
                "spotify|hello|adele|25|59".to_string(),
                Some("track-1".to_string()),
            ),
            ("spotify|missing|artist||0".to_string(), None),
        ]);

        save_spotify_track_resolutions(&entries).expect("Spotify resolutions should be writable");
        let loaded = load_spotify_track_resolutions().expect("Spotify resolutions should load");

        assert_eq!(loaded, entries);
        let _ = fs::remove_file(cache_file);
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn save_translation_cache_does_not_persist_source_lyrics() {
        let _guard = TEST_CACHE_LOCK.lock().expect("test cache lock");
        let cache_file = std::env::temp_dir().join(format!(
            "songdocent-lyrics-cache-test-{}-{}.json",
            std::process::id(),
            unix_ms()
        ));
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);

        let translated_payload = json!({
            "title": "Test Song",
            "artist": "SongDocent",
            "has_translation": true,
            "target_lang": "ko",
            "lines": [
                { "index": 0, "start_ms": 0, "text": "hello", "ko": "\u{c548}\u{b155}" },
                { "index": 1, "start_ms": 1000, "text": "bye", "ko": "\u{c798} \u{ac00}" }
            ]
        });

        save_translation_cache_blocking(
            "spotify:track:abc123".to_string(),
            "ko".to_string(),
            translated_payload,
        )
        .expect("translation cache should be writable");

        let cache_content =
            fs::read_to_string(&cache_file).expect("translation cache file should exist");
        assert!(cache_content.contains(r#""translation""#));
        assert!(!cache_content.contains("hello"));
        assert!(!cache_content.contains("bye"));
        assert!(!cache_content.contains("payload_raw"));

        let _ = fs::remove_file(cache_file);
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn applies_cached_translation_to_fresh_source_payload() {
        let _guard = TEST_CACHE_LOCK.lock().expect("test cache lock");
        let cache_file = std::env::temp_dir().join(format!(
            "songdocent-lyrics-cache-test-{}-{}.json",
            std::process::id(),
            unix_ms() + 1
        ));
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);

        let translated_payload = json!({
            "has_translation": true,
            "target_lang": "ko",
            "lines": [
                { "index": 0, "start_ms": 0, "text": "hello", "ko": "\u{c548}\u{b155}", "annotation": "greeting" },
                { "index": 1, "start_ms": 1000, "text": "bye", "ko": "\u{c798} \u{ac00}" }
            ]
        });
        save_translation_cache_blocking("abc123".to_string(), "KO".to_string(), translated_payload)
            .expect("translation cache should be writable");

        let fresh_payload = json!({
            "has_translation": false,
            "lines": [
                { "index": 0, "start_ms": 0, "text": "hello" },
                { "index": 1, "start_ms": 1000, "text": "bye" }
            ]
        });
        let cached = apply_translation_cache_blocking(
            "spotify:track:abc123?si=test".to_string(),
            "ko".to_string(),
            fresh_payload,
        )
        .expect("cache lookup should succeed");

        assert_eq!(
            cached.get("has_translation").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            cached.get("target_lang").and_then(Value::as_str),
            Some("ko")
        );
        assert_eq!(
            cached.pointer("/lines/0/ko").and_then(Value::as_str),
            Some("\u{c548}\u{b155}")
        );
        assert_eq!(
            cached
                .pointer("/lines/0/annotation")
                .and_then(Value::as_str),
            Some("greeting")
        );
        assert_eq!(
            cached.pointer("/lines/1/ko").and_then(Value::as_str),
            Some("\u{c798} \u{ac00}")
        );

        let _ = fs::remove_file(cache_file);
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn restores_annotations_without_requiring_a_translation_on_the_same_line() {
        let _guard = TEST_CACHE_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", dir.path().join("cache.json"));
        let evidence = json!({"sources": [{"url": "https://example.test/source"}]});
        let source = json!({"lines": [
            {"index": 0, "text": "First source"},
            {"index": 1, "text": "Second source"}
        ]});
        for with_translation in [false, true] {
            let mut payload = source.clone();
            payload["lines"][0]["annotation"] = json!("Manual note");
            payload["lines"][0]["annotation_grounding"] = evidence.clone();
            if with_translation {
                payload["lines"][1]["ko"] = json!("Second translation");
            }
            save_translation_cache_blocking("track".into(), "ko".into(), payload)
                .expect("standalone annotations should be saved");
            let restored = apply_translation_cache_blocking(
                "track".into(), "ko".into(), source.clone(),
            ).unwrap();
            assert_eq!(restored["lines"][0]["annotation"], "Manual note");
            assert_eq!(restored["lines"][0]["annotation_grounding"], evidence);
            assert!(restored["lines"][0].get("ko").is_none());
            assert_eq!(restored["has_translation"], with_translation);
            if with_translation {
                assert_eq!(restored["lines"][1]["ko"], "Second translation");
                assert_eq!(restored["target_lang"], "ko");
            } else {
                assert!(restored.get("target_lang").is_none());
            }
            let saved = fs::read_to_string(dir.path().join("cache.json")).unwrap();
            assert!(!saved.contains("First source"));
            assert!(!saved.contains("Second source"));
        }
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn does_not_cache_empty_annotations_or_grounding_without_content() {
        let payload = json!({"lines": [
            {"index": 0, "ko": "  ", "annotation": "annotation"},
            {"index": 1, "annotation": "none"},
            {"index": 2, "annotation_grounding": {"sources": []}}
        ]});
        assert!(extract_cached_lines(&payload, "ko").is_empty());
    }

    #[test]
    fn ignores_placeholder_annotations_when_saving_and_applying_cache() {
        let _guard = TEST_CACHE_LOCK.lock().expect("test cache lock");
        let cache_file = std::env::temp_dir().join(format!(
            "songdocent-lyrics-cache-test-{}-{}.json",
            std::process::id(),
            unix_ms() + 2
        ));
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &cache_file);

        let translated_payload = json!({
            "has_translation": true,
            "target_lang": "ko",
            "lines": [
                { "index": 0, "start_ms": 0, "text": "Ah!", "ko": "\u{c544}!", "annotation": "annotation" },
                { "index": 1, "start_ms": 1000, "text": "Nowhere", "ko": "\u{c5b4}\u{b514}\u{c5d0}\u{b3c4}", "annotation": "null" }
            ]
        });
        save_translation_cache_blocking("abc123".to_string(), "ko".to_string(), translated_payload)
            .expect("translation cache should be writable");

        let cache_content =
            fs::read_to_string(&cache_file).expect("translation cache file should exist");
        assert!(!cache_content.contains(r#""annotation": "annotation""#));
        assert!(!cache_content.contains(r#""annotation": "null""#));

        let fresh_payload = json!({
            "has_translation": false,
            "lines": [
                { "index": 0, "start_ms": 0, "text": "Ah!" },
                { "index": 1, "start_ms": 1000, "text": "Nowhere" }
            ]
        });
        let cached =
            apply_translation_cache_blocking("abc123".to_string(), "ko".to_string(), fresh_payload)
                .expect("cache lookup should succeed");

        assert_eq!(cached.pointer("/lines/0/annotation"), None);
        assert_eq!(cached.pointer("/lines/1/annotation"), None);

        let _ = fs::remove_file(cache_file);
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn builds_windows_cache_path_from_local_app_data() {
        assert_eq!(
            windows_cache_path_from(Some(r"C:\Users\SongDocent\AppData\Local")),
            Some(
                PathBuf::from(r"C:\Users\SongDocent\AppData\Local")
                    .join("SongDocent")
                    .join("lyrics-cache.json")
            )
        );
        assert_eq!(windows_cache_path_from(None), None);
        assert_eq!(windows_cache_path_from(Some("  ")), None);
    }
    #[test]
    fn old_mode_caches_merge_into_latest_language_cache() {
        let mut db = empty_db();
        let mut record = TrackCache::default();
        for (scope, updated_at) in [("ko", 1), ("ko:annotation", 3), ("ko:translation", 2)] {
            record.translations.insert(scope.into(), TranslationCache {
                grounding: None, source_fingerprint: "same".into(), lines: vec![], updated_at,
            });
        }
        db.tracks.insert("track".into(), record);
        assert!(merge_search_mode_caches(&mut db));
        let record = &db.tracks["track"];
        assert_eq!(record.translations.len(), 1);
        assert_eq!(record.translations["ko"].updated_at, 3);
        assert!(!merge_search_mode_caches(&mut db));
    }
    #[test]
    fn legacy_display_sources_are_discarded_without_losing_cached_translation() {
        let legacy = json!({
            "source_fingerprint": "same", "updated_at": 1,
            "translation_grounding": {"sources": [{"url": "https://song.test"}]},
            "lines": [{"id": "0", "translation": "번역", "annotation": "Verified note",
                "annotation_grounding": {"sources": [{"url": "https://line.test"}]}}]
        });
        let cached: TranslationCache = serde_json::from_value(legacy).unwrap();
        let serialized = serde_json::to_value(&cached).unwrap();
        assert!(serialized.get("translation_grounding").is_none());
        assert!(serialized["lines"][0].get("annotation_grounding").is_none());
        let restored = apply_cached_lines(json!({
            "translation_grounding": {"sources": []},
            "lines": [{"index": 0, "text": "Source", "annotation_grounding": {"sources": []}}]
        }), "ko", &cached.lines);
        assert_eq!(restored["lines"][0]["ko"], "번역");
        assert_eq!(restored["lines"][0]["annotation"], "Verified note");
        assert!(restored.get("translation_grounding").is_none());
        assert!(restored["lines"][0].get("annotation_grounding").is_none());
    }

    #[test]
    fn grounding_cache_is_shared_across_search_modes() {
        let _guard = TEST_CACHE_LOCK.lock().unwrap();
        let path = std::env::temp_dir().join(format!("songdocent-grounding-cache-{}-{}.json",std::process::id(),unix_ms()));
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", &path);
        let source=json!({"lines":[{"index":0,"text":"source","start_ms":0}]});
        for mode in ["translation","annotation","off"] {
            let mut translated=source.clone();
            translated["search_mode"]=json!(mode);
            translated["lines"][0]["ko"]=json!(mode);
            if mode != "off" {
                translated["lines"][0]["annotation"]=json!("verified annotation");
                translated["lines"][0]["annotation_grounding"]=json!({"sources":[{"url":"https://source.test","title":"Source"}]});
            }
            if mode == "translation" { translated["translation_grounding"]=json!({"sources":[{"url":"https://song.test","title":"Song"}]}); }
            save_translation_cache_blocking("track".into(),"ko".into(),translated).unwrap();
        }
        for mode in ["translation","annotation","off"] {
            let mut payload=source.clone(); payload["search_mode"]=json!(mode);
            let restored=apply_translation_cache_blocking("track".into(),"ko".into(),payload).unwrap();
            assert_eq!(restored["lines"][0]["ko"],"off");
            assert!(restored["lines"][0].get("annotation_grounding").is_none());
            assert!(restored.get("translation_grounding").is_none());
        }
        let mut unknown=source; unknown["search_mode"]=json!("annotation");
        let result=apply_translation_cache_blocking("missing-track".into(),"ko".into(),unknown).unwrap();
        assert_eq!(result["has_translation"],false);
        std::fs::remove_file(path).unwrap(); std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

    #[test]
    fn search_sources_survive_cache_round_trip_without_changing_shared_scope() {
        let _guard = TEST_CACHE_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("SONGDOCENT_TEST_CACHE_PATH", dir.path().join("cache.json"));
        let evidence = json!({"notes":"Verified fact", "sources":[{"url":"https://example.test/source","title":"Source"}]});
        let translated = json!({"translation_grounding":evidence,"lines":[{"index":0,"text":"source","ko":"translation","annotation":"A note","annotation_grounding":evidence}]});
        save_translation_cache_blocking("track".into(),"ko".into(),translated).unwrap();
        let restored = apply_translation_cache_blocking("track".into(),"ko".into(),json!({"lines":[{"index":0,"text":"source"}]})).unwrap();
        assert_eq!(restored["translation_grounding"], evidence);
        assert_eq!(restored["lines"][0]["annotation_grounding"], evidence);
        std::env::remove_var("SONGDOCENT_TEST_CACHE_PATH");
    }

}
