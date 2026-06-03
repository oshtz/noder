use std::path::{Path, PathBuf};

fn sanitize_segment(input: &str, allow_spaces: bool) -> String {
    let mut cleaned = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || (allow_spaces && ch == ' ') {
            cleaned.push(ch);
        } else {
            cleaned.push('_');
        }
    }
    cleaned.trim().to_string()
}

pub fn sanitize_component(input: &str, allow_spaces: bool, fallback: &str) -> String {
    let cleaned = sanitize_segment(input, allow_spaces);
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

pub fn sanitize_workflow_id(input: &str) -> String {
    sanitize_component(input, true, "workflow")
}

pub fn sanitize_extension(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

pub fn sanitize_filename(input: &str) -> String {
    let path = Path::new(input);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
    let safe_stem = sanitize_component(stem, true, "file");
    let safe_ext = sanitize_extension(ext);

    if safe_ext.is_empty() {
        safe_stem
    } else {
        format!("{}.{}", safe_stem, safe_ext)
    }
}

pub fn sanitize_relative_path(input: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    for segment in input.split(|c| c == '/' || c == '\\') {
        let trimmed = segment.trim();
        if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
            continue;
        }
        let sanitized = sanitize_segment(trimmed, true);
        if sanitized.is_empty() {
            continue;
        }
        clean.push(sanitized);
    }
    clean
}
