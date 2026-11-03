use crate::app_error::{AppError, ErrorDomain};
use crate::{cache, grounding, secrets};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudModel {
    pub id: String,
    pub label: String,
    pub description: String,
    pub search_supported: Option<bool>,
    pub structured_output_supported: Option<bool>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudModelCatalog {
    pub provider: String,
    pub models: Vec<CloudModel>,
    pub fetched_at: u64,
}

#[tauri::command]
pub async fn list_cloud_ai_models(provider: String) -> Result<CloudModelCatalog, AppError> {
    let error_provider = provider.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (endpoint, key) = match provider.as_str() {
            "gemini" => ("https://generativelanguage.googleapis.com/v1beta/models", secrets::load_gemini_api_key()?),
            "openai" => ("https://api.openai.com/v1/models", secrets::load_openai_api_key()?),
            "claude" => ("https://api.anthropic.com/v1/models", secrets::load_claude_api_key()?),
            _ => return Err("Unsupported cloud AI provider.".to_string()),
        };
        let key = key.ok_or_else(|| format!("{provider} API key is missing. Save it in SongDocent Settings."))?;
        let models = fetch_models(&provider, endpoint, &key)?;
        let catalog = CloudModelCatalog {
            provider,
            models,
            fetched_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
        };
        // Model IDs and capability metadata only; no credentials or generated text.
        if let Ok(path) = catalog_path(&catalog.provider) {
            if let Some(parent) = path.parent() { let _ = std::fs::create_dir_all(parent); }
            if let Ok(data) = serde_json::to_vec(&catalog) { let _ = std::fs::write(path, data); }
        }
        Ok(catalog)
    }).await.map_err(|e| AppError::task(ErrorDomain::Settings, "Model list task failed", e.to_string()))?
      .map_err(|e| AppError::ai(ErrorDomain::Settings, &error_provider, e))
}

fn catalog_path(provider: &str) -> Result<std::path::PathBuf, String> {
    if !matches!(provider, "gemini" | "openai" | "claude") { return Err("Unsupported provider".into()); }
    Ok(cache::cache_path()?.with_file_name(format!("models-{provider}.json")))
}

pub(crate) fn cached_search_support(provider: &str, model: &str) -> Option<bool> {
    let catalog: CloudModelCatalog = serde_json::from_slice(&std::fs::read(catalog_path(provider).ok()?).ok()?).ok()?;
    if catalog.provider != provider { return None; }
    catalog.models.iter().find(|entry| entry.id == model.trim().trim_start_matches("models/"))?.search_supported
}

fn fetch_models(provider: &str, endpoint: &str, key: &str) -> Result<Vec<CloudModel>, String> {
    let client = reqwest::blocking::Client::builder().timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    let mut cursor: Option<String> = None;
    let mut seen_cursors = HashSet::new();
    for _ in 0..20 {
        let mut request = client.get(endpoint).header("User-Agent", "SongDocent/0.1.0");
        request = match provider {
            "gemini" => request.header("x-goog-api-key", key).query(&[("pageSize", "1000")]),
            "claude" => request.header("x-api-key", key).header("anthropic-version", "2023-06-01").query(&[("limit", "100")]),
            _ => request.bearer_auth(key),
        };
        if let Some(cursor) = cursor.as_deref() {
            request = request.query(&[(if provider == "gemini" { "pageToken" } else { "after_id" }, cursor)]);
        }
        let response = request.send().map_err(|e| format!("{provider} model list request failed: {e}"))?;
        let status = response.status();
        let data = response.json::<Value>().map_err(|e| format!("{provider} model list response invalid: {e}"))?;
        if !status.is_success() { return Err(format!("{provider} model list request failed: {status} {data}")); }
        result.extend(parse_models(provider, &data)?);
        cursor = next_cursor(provider, &data)?;
        if let Some(next) = &cursor {
            if !seen_cursors.insert(next.clone()) { return Err("Model list pagination repeated a cursor.".into()); }
        } else {
            let mut seen = HashSet::new();
            result.retain(|model| seen.insert(model.id.clone()));
            if result.is_empty() { return Err("The provider did not return any text generation models.".into()); }
            return Ok(result);
        }
    }
    Err("Model list pagination exceeded the page limit.".into())
}

fn next_cursor(provider: &str, data: &Value) -> Result<Option<String>, String> {
    let field = match provider {
        "gemini" => "nextPageToken",
        "claude" if data["has_more"] == true => "last_id",
        "claude" if data.get("has_more").is_some() => return Ok(None),
        "openai" => return Ok(None),
        _ => return Err("Model list pagination metadata is missing.".into()),
    };
    let cursor = data[field].as_str().filter(|value| !value.is_empty()).map(str::to_string);
    if provider == "claude" && cursor.is_none() { return Err("Model list pagination cursor is missing.".into()); }
    Ok(cursor)
}

fn parse_models(provider: &str, data: &Value) -> Result<Vec<CloudModel>, String> {
    let field = if provider == "gemini" { "models" } else { "data" };
    let entries = data[field].as_array().ok_or_else(|| "Model list is missing its model array.".to_string())?;
    let mut result = Vec::new();
    for entry in entries {
        let id = entry[if provider == "gemini" { "name" } else { "id" }].as_str()
            .ok_or_else(|| "Model list contains an invalid model ID.".to_string())?
            .trim_start_matches("models/").trim();
        if id.is_empty() || !is_text_model(provider, id, entry) { continue; }
        let label = entry[if provider == "gemini" { "displayName" } else { "display_name" }].as_str().unwrap_or(id);
        let explicit_search = capability(entry, "web_search").or_else(|| capability(entry, "search_grounding"));
        result.push(CloudModel {
            id: id.into(), label: label.into(), description: String::new(),
            search_supported: explicit_search.or_else(|| grounding::bundled_supports_search(provider, id).then_some(true)),
            structured_output_supported: capability(entry, "structured_outputs"),
        });
    }
    Ok(result)
}

fn capability(model: &Value, name: &str) -> Option<bool> {
    let value = model.get("capabilities")?.get(name)?;
    value.as_bool().or_else(|| value.get("supported")?.as_bool())
}

fn is_text_model(provider: &str, id: &str, entry: &Value) -> bool {
    if ["embedding", "realtime", "transcribe", "tts", "image", "audio", "live", "search-preview", "search-api"].iter().any(|part| id.contains(part)) { return false; }
    if capability(entry, "structured_outputs") == Some(false) { return false; }
    match provider {
        "gemini" => entry["supportedGenerationMethods"].as_array().is_some_and(|methods| methods.iter().any(|method| method == "generateContent")),
        "openai" => id.starts_with("gpt-") || id.starts_with("chatgpt-") || ["o1", "o3", "o4"].iter().any(|prefix| id == *prefix || id.starts_with(&format!("{prefix}-"))),
        "claude" => id.starts_with("claude-"),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn parses_new_models_without_inventing_capabilities_and_filters_other_tasks() {
        let openai = parse_models("openai", &json!({"data":[{"id":"gpt-9-new"},{"id":"gpt-image-9"},{"id":"text-embedding-9"},{"id":"gpt-5.4-mini"}]})).unwrap();
        assert_eq!(openai.len(),2);
        assert_eq!(openai[0].search_supported,None);
        assert_eq!(openai[1].search_supported,Some(true));
        let gemini = parse_models("gemini", &json!({"models":[{"name":"models/gemini-9-flash","displayName":"New Flash","supportedGenerationMethods":["generateContent"]},{"name":"models/embedding","supportedGenerationMethods":["embedContent"]}]})).unwrap();
        assert_eq!(gemini.len(),1); assert_eq!(gemini[0].id,"gemini-9-flash"); assert_eq!(gemini[0].label,"New Flash");
        let claude = parse_models("claude", &json!({"data":[{"id":"claude-new","display_name":"New Claude","capabilities":{"web_search":{"supported":true},"structured_outputs":{"supported":true}}},{"id":"claude-old","capabilities":{"structured_outputs":{"supported":false}}}]})).unwrap();
        assert_eq!(claude.len(),1); assert_eq!(claude[0].search_supported,Some(true));
    }
    #[test]
    fn fetches_authenticated_pages_and_deduplicates_models() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        for provider in ["gemini", "openai", "claude"] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let endpoint = format!("http://{}/models", listener.local_addr().unwrap());
            let worker = std::thread::spawn(move || {
                let bodies = match provider {
                    "gemini" => vec![
                        json!({"models":[{"name":"models/gemini-new","supportedGenerationMethods":["generateContent"]}],"nextPageToken":"page-2"}),
                        json!({"models":[{"name":"models/gemini-new","supportedGenerationMethods":["generateContent"]},{"name":"models/gemini-newer","supportedGenerationMethods":["generateContent"]}]}),
                    ],
                    "claude" => vec![
                        json!({"data":[{"id":"claude-new"}],"has_more":true,"last_id":"claude-new"}),
                        json!({"data":[{"id":"claude-new"},{"id":"claude-newer"}],"has_more":false}),
                    ],
                    _ => vec![json!({"data":[{"id":"gpt-new"},{"id":"gpt-new"},{"id":"gpt-newer"}]})],
                };
                for (index, body) in bodies.into_iter().enumerate() {
                    let (mut stream, _) = listener.accept().unwrap();
                    stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
                    let mut request = Vec::new();
                    while !request.windows(4).any(|part| part == b"\r\n\r\n") {
                        let mut buffer = [0u8; 2048];
                        let count = stream.read(&mut buffer).unwrap();
                        assert!(count > 0);
                        request.extend_from_slice(&buffer[..count]);
                    }
                    let request = String::from_utf8(request).unwrap().to_lowercase();
                    let auth = match provider { "gemini" => "x-goog-api-key: fixture-key", "claude" => "x-api-key: fixture-key", _ => "authorization: bearer fixture-key" };
                    assert!(request.contains(auth));
                    if provider == "claude" { assert!(request.contains("anthropic-version: 2023-06-01")); }
                    if index == 1 { assert!(request.contains(if provider == "gemini" { "pagetoken=page-2" } else { "after_id=claude-new" })); }
                    let body = body.to_string();
                    write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
                }
            });
            let models = fetch_models(provider, &endpoint, "fixture-key").unwrap();
            worker.join().unwrap();
            assert_eq!(models.len(), 2);
        }
    }
    #[test]
    fn provider_pagination_is_validated() {
        assert_eq!(next_cursor("gemini", &json!({"nextPageToken":"next"})).unwrap(),Some("next".into()));
        assert_eq!(next_cursor("claude", &json!({"has_more":true,"last_id":"last"})).unwrap(),Some("last".into()));
        assert!(next_cursor("claude", &json!({"has_more":true})).is_err());
        assert!(parse_models("openai", &json!({})).is_err());
    }
}
