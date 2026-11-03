pub(crate) fn normalize_annotation_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let unquoted = trimmed
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '`'))
        .trim();
    if unquoted.is_empty() {
        return None;
    }

    let value = strip_annotation_label(unquoted).unwrap_or(unquoted).trim();
    if value.is_empty() || is_placeholder_annotation(value) {
        return None;
    }

    Some(value.to_string())
}

fn strip_annotation_label(value: &str) -> Option<&str> {
    let lower = value.to_ascii_lowercase();
    for label in ["behind the line", "expert note", "annotation"] {
        if !lower.starts_with(label) {
            continue;
        }

        let rest = value[label.len()..].trim_start();
        for separator in [":", "-", "—"] {
            if let Some(body) = rest.strip_prefix(separator) {
                return Some(body.trim_start());
            }
        }
    }
    None
}

fn is_placeholder_annotation(value: &str) -> bool {
    let compact = value
        .chars()
        .filter(|ch| !matches!(ch, ' ' | '\t' | '\n' | '\r' | '_' | '-' | ':' | '/' | '.'))
        .flat_map(char::to_lowercase)
        .collect::<String>();

    matches!(
        compact.as_str(),
        "annotation"
            | "null"
            | "none"
            | "na"
            | "notapplicable"
            | "noannotation"
            | "noannotationneeded"
            | "notneeded"
            | "behindtheline"
            | "expertnote"
            | "없음"
            | "해당없음"
            | "주석없음"
            | "설명없음"
            | "なし"
            | "該当なし"
            | "注釈なし"
    ) || compact.starts_with("contentisnotempty")
        || compact.contains("butidisnot")
}
