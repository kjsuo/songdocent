use super::{classify_error, Provider};
use serde_json::{json, Value};

#[derive(Default)]
pub struct Events {
    pub text: String,
    pub sources: Vec<Value>,
    pub searched: bool,
    pub completed: bool,
}

impl Events {
    pub fn push(
        &mut self,
        provider: Provider,
        line: &str,
        on_text: &mut dyn FnMut(&str),
    ) -> Result<(), String> {
        if !line.trim_start().starts_with('{') {
            return Ok(());
        }
        let value: Value =
            serde_json::from_str(line).map_err(|_| "CLI_RESPONSE_INVALID: invalid event JSON")?;
        let kind = value["type"].as_str().unwrap_or("");
        if matches!(kind, "error" | "turn.failed")
            || value["is_error"] == true
            || value["status"] == "error"
        {
            return Err(classify_error(&value.to_string()));
        }
        match provider {
            Provider::Antigravity => {
                if value["event"] == "step_update" {
                    let step = &value["step_update"];
                    let tool = step["tool_info"]["name"].as_str()
                        .or_else(|| step["tool_name"].as_str()).unwrap_or("");
                    if step["step_type"] == "tool" && step["state"] == "DONE"
                        && matches!(tool, "search_web" | "read_url_content")
                    {
                        if step["tool_info"].get("error").is_some_and(|error| !error.is_null()) {
                            return Err("CLI_SEARCH_UNAVAILABLE: web search failed".into());
                        }
                        self.searched = true;
                        self.collect_urls(&step["tool_info"]["output"]);
                    }
                }
                if value["event"] == "result" {
                    let result = &value["result"];
                    match result["status"].as_str() {
                        Some("SUCCESS") => {}
                        Some("CANCELED" | "INTERRUPTED") => return Err("CLI_CANCELLED: request cancelled".into()),
                        _ => return Err(classify_error(result["error"].as_str().unwrap_or("CLI response failed"))),
                    }
                    let text = result.get("structured_output").filter(|output| output.is_object())
                        .map(Value::to_string)
                        .unwrap_or_else(|| result["response"].as_str().unwrap_or("").to_owned());
                    self.text.clear();
                    self.append(&text, on_text);
                    self.completed = true;
                }
            }
            Provider::Codex => {
                if kind == "item.completed" {
                    let item = &value["item"];
                    match item["type"].as_str().unwrap_or("") {
                        "agent_message" => {
                            self.text.clear();
                            self.append(item["text"].as_str().unwrap_or(""), on_text)
                        }
                        "web_search" => {
                            if item["status"] == "failed" {
                                return Err("CLI_SEARCH_UNAVAILABLE: web search failed".into());
                            }
                            self.searched = true;
                            if item["action"]["type"] == "open_page" {
                                self.add_url(item["action"]["url"].as_str().unwrap_or(""), "");
                            }
                            self.collect_urls(item.get("sources").unwrap_or(&Value::Null));
                        }
                        _ => {}
                    }
                }
                if kind == "turn.completed" {
                    self.completed = true;
                }
            }
            Provider::Claude => {
                if kind == "stream_event" && value["event"]["delta"]["type"] == "text_delta" {
                    self.append(
                        value["event"]["delta"]["text"].as_str().unwrap_or(""),
                        on_text,
                    );
                }
                if kind == "assistant" {
                    if let Some(content) = value["message"]["content"].as_array() {
                        for block in content {
                            if block["type"] == "tool_use"
                                && block["name"].as_str().is_some_and(is_search_tool)
                            {
                                self.searched = true;
                            }
                        }
                    }
                }
                if kind == "user" {
                    if let Some(content) = value["message"]["content"].as_array() {
                        for block in content {
                            if block["type"] == "tool_result" {
                                if block["is_error"] == true {
                                    return Err("CLI_SEARCH_UNAVAILABLE: web search failed".into());
                                }
                                self.collect_urls(&block["content"]);
                            }
                        }
                    }
                }
                if kind == "result" {
                    self.completed = true;
                    let result = value
                        .get("structured_output")
                        .filter(|v| v.is_object())
                        .map(Value::to_string)
                        .unwrap_or_else(|| value["result"].as_str().unwrap_or("").to_owned());
                    if !result.is_empty() && self.text != result {
                        if self.text.is_empty() {
                            self.append(&result, on_text);
                        } else {
                            self.text = result;
                        }
                    }
                }
            }
            Provider::Gemini => {
                if kind == "message" && value["role"] == "assistant" {
                    self.append(value["content"].as_str().unwrap_or(""), on_text);
                }
                if kind == "tool_use" && value["tool_name"].as_str().is_some_and(is_search_tool) {
                    self.searched = true;
                }
                if kind == "tool_result" {
                    if value["status"] == "error" {
                        return Err("CLI_SEARCH_UNAVAILABLE: web search failed".into());
                    }
                    self.collect_urls(&value["output"]);
                }
                if kind == "result" {
                    self.completed = true;
                }
            }
            Provider::OpenCode => {
                if kind == "text" {
                    self.append(value["part"]["text"].as_str().unwrap_or(""), on_text);
                }
                if kind == "tool_use" && value["part"]["tool"].as_str().is_some_and(is_search_tool)
                {
                    self.searched = true;
                    let state = &value["part"]["state"];
                    if state["status"] == "error" {
                        return Err("CLI_SEARCH_UNAVAILABLE: web search failed".into());
                    }
                    if state["status"] == "completed" {
                        self.collect_urls(&state["output"]);
                        self.collect_urls(&state["metadata"]);
                    }
                }
                if kind == "step_finish" {
                    self.completed = value["part"]["reason"]
                        .as_str()
                        .is_none_or(|reason| reason == "stop");
                }
            }
        }
        Ok(())
    }
    fn append(&mut self, text: &str, on_text: &mut dyn FnMut(&str)) {
        self.text.push_str(text);
        on_text(text);
    }
    fn add_url(&mut self, url: &str, title: &str) {
        if !crate::grounding::safe_source_url(url)
            || self.sources.iter().any(|source| source["url"] == url)
        {
            return;
        }
        self.sources
            .push(json!({"url":url,"title":if title.is_empty() { url } else { title }}));
    }
    fn collect_urls(&mut self, value: &Value) {
        match value {
            Value::Object(object) => {
                if let Some(url) = value["url"].as_str().or_else(|| value["uri"].as_str()) {
                    self.add_url(url, value["title"].as_str().unwrap_or(""));
                }
                for child in object.values() {
                    self.collect_urls(child);
                }
            }
            Value::Array(items) => {
                for child in items {
                    self.collect_urls(child);
                }
            }
            Value::String(text) => {
                for token in text.split(|c: char| {
                    c.is_whitespace() || matches!(c, '"' | '<' | '>' | '(' | ')' | '[' | ']' | '`')
                }) {
                    let token = token.trim_end_matches([',', '.', ';']);
                    if token.starts_with("https://") || token.starts_with("http://") {
                        self.add_url(token, "");
                    }
                }
            }
            _ => {}
        }
    }
}
fn is_search_tool(tool: &str) -> bool {
    matches!(
        tool,
        "WebSearch" | "WebFetch" | "google_web_search" | "web_fetch" | "websearch" | "webfetch"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn antigravity_uses_completed_structured_output_and_rejects_failed_results() {
        let mut events = Events::default();
        let mut emitted = String::new();
        events.push(Provider::Antigravity, &json!({"event":"step_update","step_update":{
            "step_type":"agent_response","state":"ACTIVE","text_delta":"Planning the answer"
        }}).to_string(), &mut |text| emitted.push_str(text)).unwrap();
        assert!(emitted.is_empty());
        events.push(Provider::Antigravity, &json!({"event":"result","result":{
            "status":"SUCCESS","response":"untrusted fallback",
            "structured_output":{"ok":true}
        }}).to_string(), &mut |text| emitted.push_str(text)).unwrap();
        assert!(events.completed);
        assert_eq!(serde_json::from_str::<Value>(&events.text).unwrap(), json!({"ok":true}));
        assert_eq!(emitted, events.text);

        for (status, message, code) in [
            ("ERROR", "authentication required", "CLI_AUTH_REQUIRED"),
            ("ERROR", "quota exceeded", "CLI_RATE_LIMITED"),
            ("CANCELED", "", "CLI_CANCELLED"),
            ("WAITING", "", "CLI_PROCESS_FAILED"),
        ] {
            let mut events = Events::default();
            let error = events.push(Provider::Antigravity, &json!({"event":"result",
                "result":{"status":status,"error":message,"response":"discard"}
            }).to_string(), &mut |_| {}).unwrap_err();
            assert!(error.starts_with(code), "{error}");
            assert!(!events.completed);
            assert!(events.text.is_empty());
        }
    }

    #[test]
    fn antigravity_research_accepts_sources_only_from_successful_web_tools() {
        let mut events = Events::default();
        events.push(Provider::Antigravity, &json!({"event":"step_update","step_update":{
            "step_type":"tool","state":"DONE","tool_name":"read_url_content",
            "tool_info":{"output":{"url":"https://example.test/source","title":"Source"}}
        }}).to_string(), &mut |_| {}).unwrap();
        events.push(Provider::Antigravity, &json!({"event":"result","result":{
            "status":"SUCCESS","response":"Invented reference https://invented.test"
        }}).to_string(), &mut |_| {}).unwrap();
        assert!(events.searched);
        assert_eq!(events.sources, vec![json!({"url":"https://example.test/source","title":"Source"})]);
        assert!(events.push(Provider::Antigravity, &json!({"event":"step_update","step_update":{
            "step_type":"tool","state":"DONE","tool_name":"search_web",
            "tool_info":{"error":{"message":"failed"}}
        }}).to_string(), &mut |_| {}).unwrap_err().starts_with("CLI_SEARCH_UNAVAILABLE"));
    }

    #[test]
    fn extracts_answers_without_thinking_and_never_trusts_final_answer_urls() {
        let samples = [
            (
                Provider::Codex,
                json!({"type":"item.completed","item":{"type":"agent_message","text":"answer https://invented.test"}}),
            ),
            (
                Provider::Claude,
                json!({"type":"result","result":"answer https://invented.test"}),
            ),
            (
                Provider::Gemini,
                json!({"type":"message","role":"assistant","content":"answer https://invented.test"}),
            ),
            (
                Provider::OpenCode,
                json!({"type":"text","part":{"text":"answer https://invented.test"}}),
            ),
        ];
        for (provider, event) in samples {
            let mut events = Events::default();
            events
                .push(provider, &event.to_string(), &mut |_| {})
                .unwrap();
            assert!(events.text.starts_with("answer"));
            assert!(events.sources.is_empty());
        }
    }
    #[test]
    fn collects_only_successful_search_outputs() {
        let mut events = Events::default();
        events.push(Provider::OpenCode, &json!({"type":"tool_use","part":{"tool":"websearch","state":{"status":"completed","output":"[source](https://example.test/a)","metadata":{"url":"javascript:bad"}}}}).to_string(), &mut |_| {}).unwrap();
        assert!(events.searched);
        assert_eq!(events.sources.len(), 1);
        assert!(events
            .push(
                Provider::Claude,
                r#"{"type":"result","is_error":true,"result":"Not logged in"}"#,
                &mut |_| {}
            )
            .unwrap_err()
            .starts_with("CLI_AUTH_REQUIRED"));
    }
    #[test]
    fn codex_uses_the_final_answer_instead_of_progress_messages() {
        let mut events = Events::default();
        for text in [
            "Checking the references…",
            "{\"annotation\":\"Verified answer\"}",
        ] {
            events
                .push(
                    Provider::Codex,
                    &json!({"type":"item.completed","item":{"type":"agent_message","text":text}})
                        .to_string(),
                    &mut |_| {},
                )
                .unwrap();
        }
        assert_eq!(events.text, "{\"annotation\":\"Verified answer\"}");
    }
}
