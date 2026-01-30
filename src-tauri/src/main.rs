// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{Manager, generate_handler, generate_context, Builder, State, Emitter};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, USER_AGENT};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AnthropicRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: Option<i32>,
    temperature: Option<f32>,
    system: Option<String>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Message {
    role: String,
    content: String
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AnthropicResponse {
    content: Vec<Content>,
    id: String,
    model: String,
    role: String,
    stop_reason: Option<String>,
    stop_sequence: Option<String>,
    usage: Usage
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Content {
    text: String,
    #[serde(rename = "type")]
    content_type: String
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Usage {
    input_tokens: i32,
    output_tokens: i32
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIChatMessage {
    role: String,
    content: String
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIChatRequest {
    model: String,
    messages: Vec<OpenAIChatMessage>,
    temperature: f32
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIChatChoice {
    message: OpenAIChatMessage
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIChatResponse {
    choices: Vec<OpenAIChatChoice>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIModel {
    id: String,
    owned_by: Option<String>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModel>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Workflow {
    name: String,
    id: String,
    data: serde_json::Value
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WhatsAppStatus {
    status: String,
    timestamp: String,
    #[serde(rename = "isAuthenticated")]
    is_authenticated: bool,
    #[serde(rename = "isClientReady")]
    is_client_ready: bool,
    #[serde(rename = "isInitializing")]
    is_initializing: bool
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WhatsAppReceivedMessage {
    from: String,
    to: String,
    #[serde(rename = "fromMe")]
    from_me: bool,
    content: String,
    timestamp: String
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicateInput {
    prompt: Option<String>,
    #[serde(flatten)]
    other: serde_json::Map<String, serde_json::Value>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicatePredictionRequest {
    version: Option<String>,
    input: serde_json::Value,
    webhook: Option<String>,
    webhook_events_filter: Option<Vec<String>>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicatePrediction {
    id: String,
    status: String,
    output: Option<serde_json::Value>,
    error: Option<String>,
    logs: Option<String>,
    #[serde(default)]
    metrics: Option<serde_json::Value>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicateModel {
    owner: String,
    name: String,
    description: Option<String>,
    visibility: String,
    github_url: Option<String>,
    paper_url: Option<String>,
    license_url: Option<String>,
    run_count: i64,
    cover_image_url: Option<String>,
    default_example: Option<serde_json::Value>,
    latest_version: Option<serde_json::Value>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicateModelsResponse {
    next: Option<String>,
    previous: Option<String>,
    results: Vec<ReplicateModel>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FloatingButtonPosition {
    x: f32,
    y: f32
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppSettings {
    replicate_api_key: Option<String>,
    openai_api_key: Option<String>,
    openrouter_api_key: Option<String>,
    anthropic_api_key: Option<String>,
    gemini_api_key: Option<String>,
    ollama_base_url: Option<String>,
    lm_studio_base_url: Option<String>,
    default_save_location: Option<String>,
    show_templates: Option<bool>,
    show_assistant_panel: Option<bool>,
    run_button_unlocked: Option<bool>,
    run_button_position: Option<FloatingButtonPosition>,
    // Default models for node types
    default_text_model: Option<String>,
    default_image_model: Option<String>,
    default_video_model: Option<String>,
    default_audio_model: Option<String>,
    default_upscaler_model: Option<String>,
    // Edge appearance
    edge_type: Option<String>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicateFileUpload {
    id: String,
    name: String,
    content_type: String,
    size: i64,
    urls: ReplicateFileUrls,
    created_at: String,
    expires_at: Option<String>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReplicateFileUrls {
    get: String
}

#[derive(Debug, Clone)]
struct WhatsAppState(Arc<Mutex<WhatsAppStatus>>);

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

fn sanitize_component(input: &str, allow_spaces: bool, fallback: &str) -> String {
    let cleaned = sanitize_segment(input, allow_spaces);
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

fn sanitize_workflow_id(input: &str) -> String {
    sanitize_component(input, true, "workflow")
}

fn sanitize_extension(input: &str) -> String {
    input.chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}

fn sanitize_filename(input: &str) -> String {
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

fn sanitize_relative_path(input: &str) -> PathBuf {
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

fn mask_phone_number(input: &str) -> String {
    let digits: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() <= 4 {
        "***".to_string()
    } else {
        let tail = &digits[digits.len() - 4..];
        format!("***{}", tail)
    }
}

fn escape_powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

fn escape_bash_literal(value: &str) -> String {
    value.replace('\'', "'\\''")
}

fn resolve_destination_folder(
    app_handle: &tauri::AppHandle,
    destination_folder: Option<String>
) -> Result<PathBuf, String> {
    let download_dir = app_handle.path().download_dir()
        .map_err(|e| format!("Failed to get downloads directory: {}", e))?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let base_dir = download_dir.join("noder");

    if let Some(folder) = destination_folder {
        let trimmed = folder.trim();
        if trimmed.is_empty() {
            return Ok(base_dir);
        }

        let candidate = PathBuf::from(trimmed);
        if candidate.is_absolute() {
            if candidate.starts_with(&download_dir) || candidate.starts_with(&app_data_dir) {
                return Ok(candidate);
            }
            return Err("Destination folder must be within Downloads or app data directory.".to_string());
        }

        let relative = sanitize_relative_path(trimmed);
        if relative.as_os_str().is_empty() {
            return Ok(base_dir);
        }

        let first_segment = relative.components()
            .next()
            .and_then(|c| c.as_os_str().to_str())
            .unwrap_or("");
        let root = if first_segment.eq_ignore_ascii_case("downloads") {
            download_dir.parent().unwrap_or(&download_dir).to_path_buf()
        } else {
            download_dir.clone()
        };

        return Ok(root.join(relative));
    }

    Ok(base_dir)
}

#[tauri::command]
async fn fetch_github_release(repo: String) -> Result<serde_json::Value, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header(USER_AGENT, "noder-updater")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release: {}", e))?;

    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("GitHub API error ({}): {}", status, body));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse release: {}", e))?;

    Ok(json)
}

#[tauri::command]
async fn download_update(
    app_handle: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
    dir_name: Option<String>
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header(USER_AGENT, "noder-updater")
        .send()
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Download failed ({}): {}", status, error_text));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read update bytes: {}", e))?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let update_dir = dir_name.unwrap_or_else(|| "noder-updates".to_string());
    let safe_dir = sanitize_component(&update_dir, false, "noder-updates");
    let updates_dir = app_data_dir.join(safe_dir);

    if !updates_dir.exists() {
        fs::create_dir_all(&updates_dir)
            .map_err(|e| format!("Failed to create update folder: {}", e))?;
    }

    let raw_name = file_name.unwrap_or_else(|| {
        url.split('/')
            .last()
            .filter(|name| !name.is_empty())
            .unwrap_or("update.bin")
            .to_string()
    });
    let safe_name = sanitize_filename(&raw_name);
    let file_path = updates_dir.join(safe_name);

    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write update file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn apply_update(app: tauri::AppHandle, update_path: String) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("Auto-update is disabled in dev builds.".to_string());
    }

    let update_file = Path::new(&update_path);
    if !update_file.exists() {
        return Err("Update file not found.".to_string());
    }

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let pid = std::process::id();

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "$procId = {pid}; $source = '{source}'; $target = '{target}'; \
             while (Get-Process -Id $procId -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 200 }}; \
             Move-Item -Force $source $target; Start-Process -FilePath $target",
            pid = pid,
            source = escape_powershell_literal(&update_file.to_string_lossy()),
            target = escape_powershell_literal(&current_exe.to_string_lossy())
        );

        Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let app_bundle = current_exe
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .ok_or("Could not determine app bundle path")?;

        let script = format!(
            r#"
pid={}
source='{}'
target='{}'

while kill -0 $pid 2>/dev/null; do sleep 0.2; done
rm -rf "$target"
mv -f "$source" "$target"
open "$target"
"#,
            pid,
            escape_bash_literal(&update_file.to_string_lossy()),
            escape_bash_literal(&app_bundle.to_string_lossy())
        );

        Command::new("bash")
            .args(["-c", &script])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("Auto-update is not supported on this platform.".to_string());
    }

    app.exit(0);
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn extract_app_zip(zip_path: String) -> Result<String, String> {
    let zip_file = Path::new(&zip_path);
    let parent = zip_file.parent().ok_or("Invalid zip path")?;

    let status = Command::new("ditto")
        .args(["-xk", &zip_path, &parent.to_string_lossy()])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("Failed to extract update".to_string());
    }

    let app_path = parent.join("noder.app");
    if !app_path.exists() {
        return Err("Extracted app not found.".to_string());
    }

    fs::remove_file(zip_file).ok();

    Ok(app_path.to_string_lossy().to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn extract_app_zip(_zip_path: String) -> Result<String, String> {
    Err("This command is only available on macOS".to_string())
}

#[tauri::command]
async fn anthropic_request(api_key: String, model: String, system_prompt: String, user_content: String, temperature: f32) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert("x-api-key", HeaderValue::from_str(&api_key).map_err(|e| e.to_string())?);
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let messages = vec![
        Message {
            role: "user".to_string(),
            content: user_content
        }
    ];

    let request_body = AnthropicRequest {
        model,
        messages,
        max_tokens: Some(1024),
        temperature: Some(temperature),
        system: Some(system_prompt)
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.map_err(|e| e.to_string())?;
        return Err(format!("API request failed: {}", error_text));
    }

    let response_data: AnthropicResponse = response.json().await.map_err(|e| e.to_string())?;
    
    // Return the first text content
    if let Some(content) = response_data.content.first() {
        Ok(content.text.clone())
    } else {
        Err("No content in response".to_string())
    }
}

#[tauri::command]
async fn openai_list_models(app_handle: tauri::AppHandle) -> Result<Vec<OpenAIModel>, String> {
    let settings = load_settings(app_handle).await?;
    let api_key = settings.openai_api_key
        .ok_or("OpenAI API key not configured. Please add it in Settings.")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    let response = client
        .get("https://api.openai.com/v1/models")
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("OpenAI API error: {}", error_text));
    }

    let models: OpenAIModelsResponse = response.json().await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models.data)
}

#[tauri::command]
async fn openai_chat_completion(
    app_handle: tauri::AppHandle,
    model: String,
    system_prompt: String,
    user_content: String,
    temperature: Option<f32>
) -> Result<String, String> {
    let settings = load_settings(app_handle).await?;
    let api_key = settings.openai_api_key
        .ok_or("OpenAI API key not configured. Please add it in Settings.")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let prompt = if system_prompt.trim().is_empty() {
        "You are a helpful assistant".to_string()
    } else {
        system_prompt
    };

    let request_body = OpenAIChatRequest {
        model,
        messages: vec![
            OpenAIChatMessage {
                role: "system".to_string(),
                content: prompt
            },
            OpenAIChatMessage {
                role: "user".to_string(),
                content: user_content
            }
        ],
        temperature: temperature.unwrap_or(0.7)
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to create completion: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("OpenAI API error: {}", error_text));
    }

    let response_data: OpenAIChatResponse = response.json().await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    response_data.choices.first()
        .map(|choice| choice.message.content.clone())
        .ok_or("No content in OpenAI response".to_string())
}

#[tauri::command]
fn save_workflow(app_handle: tauri::AppHandle, name: String, data: serde_json::Value) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let workflows_dir = app_data.join("workflows");
    
    if !workflows_dir.exists() {
        fs::create_dir_all(&workflows_dir).map_err(|e| e.to_string())?;
    }

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Workflow name cannot be empty".to_string());
    }

    let safe_id = sanitize_workflow_id(trimmed_name);
    let file_path = workflows_dir.join(format!("{}.json", safe_id));
    let workflow = Workflow { name: trimmed_name.to_string(), id: safe_id, data };
    let json = serde_json::to_string_pretty(&workflow).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_workflows(app_handle: tauri::AppHandle) -> Result<Vec<Workflow>, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let workflows_dir = app_data.join("workflows");
    
    if !workflows_dir.exists() {
        return Ok(vec![]);
    }

    let mut workflows = Vec::new();
    for entry in fs::read_dir(workflows_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
            let workflow: Workflow = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            workflows.push(workflow);
        }
    }
    Ok(workflows)
}

#[tauri::command]
fn load_workflow(app_handle: tauri::AppHandle, id: String) -> Result<Workflow, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let safe_id = sanitize_workflow_id(id.trim());
    let file_path = app_data.join("workflows").join(format!("{}.json", safe_id));
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let workflow: Workflow = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(workflow)
}

#[tauri::command]
fn rename_workflow(app_handle: tauri::AppHandle, id: String, new_name: String) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let workflows_dir = app_data.join("workflows");
    let safe_old_id = sanitize_workflow_id(id.trim());
    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty() {
        return Err("Workflow name cannot be empty".to_string());
    }
    let safe_new_id = sanitize_workflow_id(trimmed_name);
    let old_path = workflows_dir.join(format!("{}.json", safe_old_id));
    let new_path = workflows_dir.join(format!("{}.json", safe_new_id));
    
    let content = fs::read_to_string(&old_path).map_err(|e| e.to_string())?;
    let mut workflow: Workflow = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    workflow.name = trimmed_name.to_string();
    workflow.id = safe_new_id;
    
    let json = serde_json::to_string_pretty(&workflow).map_err(|e| e.to_string())?;
    fs::write(&new_path, json).map_err(|e| e.to_string())?;
    fs::remove_file(old_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_workflow(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let safe_id = sanitize_workflow_id(id.trim());
    let file_path = app_data.join("workflows").join(format!("{}.json", safe_id));
    fs::remove_file(file_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_workflow(app_handle: tauri::AppHandle) -> Result<Workflow, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let workflows_dir = app_data.join("workflows");
    
    if !workflows_dir.exists() {
        fs::create_dir_all(&workflows_dir).map_err(|e| e.to_string())?;
    }

    // Generate a unique name for the new workflow
    let timestamp = Utc::now().timestamp();
    let name = format!("New Workflow {}", timestamp);
    let id = sanitize_workflow_id(&name);
    
    // Create an empty workflow with default data
    let data = serde_json::json!({
        "nodes": [],
        "edges": []
    });
    
    let workflow = Workflow { name, id: id.clone(), data };
    
    // Save the workflow to disk
    let file_path = workflows_dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&workflow).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())?;
    
    Ok(workflow)
}

#[tauri::command]
async fn send_whatsapp_message(
    phone_number: String,
    message: String,
    app_handle: tauri::AppHandle,
    state: State<'_, WhatsAppState>
) -> Result<(), String> {
    // Check if WhatsApp is connected
    let whatsapp_status = state.0.lock()
        .map_err(|_| "Failed to lock WhatsApp state".to_string())?
        .clone();
    println!("Current WhatsApp status: {:?}", whatsapp_status);
    if !whatsapp_status.is_authenticated || !whatsapp_status.is_client_ready {
        let err = format!("WhatsApp is not connected (status: {}). Please scan the QR code first.", whatsapp_status.status);
        println!("{}", err);
        return Err(err);
    }

    // Format phone number (remove any non-numeric characters)
    let phone_number = phone_number.chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>();
    println!(
        "Sending WhatsApp message to {} ({} chars)",
        mask_phone_number(&phone_number),
        message.len()
    );
    
    // Get app data directory
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| {
            let err = format!("Failed to get app data directory: {}", e);
            println!("{}", err);
            err
        })?;
    let data_dir = app_data.join("whatsapp");
    if cfg!(debug_assertions) {
        println!("Using data directory: {}", data_dir.display());
    }

    // Create data directory if it doesn't exist
    if !data_dir.exists() {
    if cfg!(debug_assertions) {
        println!("Creating data directory");
    }
        fs::create_dir_all(&data_dir).map_err(|e| {
            let err = format!("Failed to create data directory: {}", e);
            println!("{}", err);
            err
        })?;
    }

    // List directory contents
    if cfg!(debug_assertions) {
        println!("Directory contents before:");
        if let Ok(entries) = fs::read_dir(&data_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    println!("  {}", entry.path().display());
                }
            }
        }
    }
    
    // Create the message file
    let message_data = serde_json::json!({
        "phoneNumber": phone_number,
        "message": message
    });

    let message_path = data_dir.join("message.json");
    let error_path = data_dir.join("message_error.txt");
    if cfg!(debug_assertions) {
        println!("Message path: {}", message_path.display());
        println!("Error path: {}", error_path.display());
    }

    // Remove any existing error file
    if error_path.exists() {
    if cfg!(debug_assertions) {
        println!("Removing existing error file");
    }
        fs::remove_file(&error_path).map_err(|e| {
            let err = format!("Failed to remove error file: {}", e);
            println!("{}", err);
            err
        })?;
    }

    // Write message data
    if cfg!(debug_assertions) {
        println!("Writing message data to file");
    }
    fs::write(
        &message_path,
        serde_json::to_string_pretty(&message_data).map_err(|e| {
            let err = format!("Failed to serialize message data: {}", e);
            println!("{}", err);
            err
        })?
    ).map_err(|e| {
        let err = format!("Failed to write message file: {}", e);
        println!("{}", err);
        err
    })?;

    // List directory contents after writing
    if cfg!(debug_assertions) {
        println!("Directory contents after writing:");
        if let Ok(entries) = fs::read_dir(&data_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    println!("  {}", entry.path().display());
                }
            }
        }
    }

    // Wait for the message to be processed (max 5 seconds)
    if cfg!(debug_assertions) {
        println!("Waiting for message to be processed");
    }
    let start = std::time::Instant::now();
    while message_path.exists() && start.elapsed() < std::time::Duration::from_secs(5) {
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Check for error
        if error_path.exists() {
            let error = fs::read_to_string(&error_path)
                .map_err(|e| {
                    let err = format!("Failed to read error file: {}", e);
                    println!("{}", err);
                    err
                })?;
            println!("Error from WhatsApp service: {}", error);
            fs::remove_file(&error_path).ok();
            return Err(error);
        }
    }

    // Check if message file still exists (timeout)
    if message_path.exists() {
        println!("Message sending timed out");
        // List directory contents after timeout
        if cfg!(debug_assertions) {
            println!("Directory contents after timeout:");
            if let Ok(entries) = fs::read_dir(&data_dir) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        println!("  {}", entry.path().display());
                    }
                }
            }
        }
        fs::remove_file(&message_path).ok();
        return Err("Timeout while sending message".to_string());
    }

    println!("Message sent successfully");
    Ok(())
}

#[tauri::command]
async fn get_whatsapp_status(app: tauri::AppHandle, state: State<'_, WhatsAppState>) -> Result<WhatsAppStatus, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let status_file = app_data.join("whatsapp").join("status.txt");

    if !status_file.exists() {
        return Ok(WhatsAppStatus {
            status: "disconnected".to_string(),
            timestamp: "0".to_string(),
            is_authenticated: false,
            is_client_ready: false,
            is_initializing: false
        });
    }

    let content = fs::read_to_string(&status_file)
        .map_err(|e| format!("Failed to read status file: {}", e))?;

    let status: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse status JSON: {}", e))?;

    let mut whatsapp_status = state.0.lock()
        .map_err(|_| "Failed to lock WhatsApp state".to_string())?;
    *whatsapp_status = WhatsAppStatus {
        status: status["status"].as_str().unwrap_or("disconnected").to_string(),
        timestamp: status["timestamp"].as_str().unwrap_or("0").to_string(),
        is_authenticated: status["isAuthenticated"].as_bool().unwrap_or(false),
        is_client_ready: status["isClientReady"].as_bool().unwrap_or(false),
        is_initializing: status["isInitializing"].as_bool().unwrap_or(false)
    };

    Ok(whatsapp_status.clone())
}

#[tauri::command]
async fn init_whatsapp(app_handle: tauri::AppHandle, state: State<'_, WhatsAppState>) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let whatsapp_dir = app_data.join("whatsapp");
    
    if !whatsapp_dir.exists() {
        fs::create_dir_all(&whatsapp_dir).map_err(|e| e.to_string())?;
    }

    // Set environment variable for WhatsApp service
    let whatsapp_dir_str = whatsapp_dir.to_str()
        .ok_or("Invalid WhatsApp data directory path")?;
    std::env::set_var("WHATSAPP_DATA_DIR", whatsapp_dir_str);

    // Create a dummy status file to indicate initialization
    let status_file = whatsapp_dir.join("status.txt");
    let init_status = WhatsAppStatus {
        status: "initializing".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        is_authenticated: false,
        is_client_ready: false,
        is_initializing: true
    };
    
    // Write initial status to file
    if let Ok(status_json) = serde_json::to_string_pretty(&init_status) {
        let _ = fs::write(&status_file, status_json);
    }

    // Start monitoring WhatsApp status
    let qr_file = whatsapp_dir.join("qr.txt");
    let qr_file_clone = qr_file.clone(); // Clone the PathBuf before moving it
    let app_handle_clone = app_handle.clone();
    let state = Arc::clone(&state.0);

    thread::spawn(move || {
        let mut last_status = String::new();
        let mut last_qr = String::new();

        loop {
            // Check status
            if let Ok(status_content) = fs::read_to_string(&status_file) {
                if let Ok(status_data) = serde_json::from_str::<WhatsAppStatus>(&status_content) {
                    if status_data.status != last_status {
                        last_status = status_data.status.clone();
                        if let Ok(mut state) = state.lock() {
                            *state = status_data.clone();
                        }
                        let _ = app_handle_clone.emit("whatsapp-status", status_data);
                    }
                }
            }

            // Check QR code
            if let Ok(qr) = fs::read_to_string(&qr_file_clone) {
                let qr = qr.trim();
                if qr != last_qr {
                    last_qr = qr.to_string();
                    let _ = app_handle_clone.emit("whatsapp-qr", qr);
                }
            }

            thread::sleep(std::time::Duration::from_millis(500));
        }
    });

    // Emit a status update to indicate initialization
    app_handle.emit("whatsapp-status", init_status).ok();

    Ok(())
}

#[tauri::command]
async fn listen_whatsapp_messages(
    id: String,
    phone_numbers: Vec<String>,
    command: String,
    app_handle: tauri::AppHandle,
    _state: State<'_, WhatsAppState>
) -> Result<(), String> {
    let data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("whatsapp");

    // Create listeners.json file
    let listeners_file = data_dir.join("listeners.json");
    let listeners_data = serde_json::json!({
        "id": id,
        "phoneNumbers": phone_numbers,
        "command": command
    });

    fs::write(&listeners_file, serde_json::to_string_pretty(&listeners_data).unwrap())
        .map_err(|e| format!("Failed to write listeners file: {}", e))?;

    // Start a thread to check for received messages
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        let mut last_check = std::time::SystemTime::now();
        
        loop {
            thread::sleep(Duration::from_millis(500));

            let received_file = data_dir.join(format!("received_{}.json", id));
            
            match fs::metadata(&received_file) {
                Ok(metadata) => {
                    if let Ok(modified) = metadata.modified() {
                        if modified > last_check {
                            if let Ok(content) = fs::read_to_string(&received_file) {
                                if let Ok(message) = serde_json::from_str::<WhatsAppReceivedMessage>(&content) {
                                    // Emit the received message event
                                    let _ = app_handle_clone.emit("whatsapp-message-received", message.clone());
                                    
                                    // Remove the file after processing
                                    let _ = fs::remove_file(&received_file);
                                }
                            }
                            last_check = std::time::SystemTime::now();
                        }
                    }
                }
                Err(_) => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn stop_whatsapp_listener(
    id: String,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    let data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("whatsapp");

    // Create remove_listener.txt file
    let remove_file = data_dir.join("remove_listener.txt");
    fs::write(&remove_file, id)
        .map_err(|e| format!("Failed to write remove listener file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let settings_file = app_data.join("settings.json");
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(settings_file, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn load_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let settings_file = app_data.join("settings.json");

    if !settings_file.exists() {
        return Ok(AppSettings {
            replicate_api_key: None,
            openai_api_key: None,
            openrouter_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            ollama_base_url: Some("http://localhost:11434".to_string()),
            lm_studio_base_url: Some("http://localhost:1234".to_string()),
            default_save_location: None,
            show_templates: None,
            show_assistant_panel: None,
            run_button_unlocked: None,
            run_button_position: None,
            default_text_model: None,
            default_image_model: None,
            default_video_model: None,
            default_audio_model: None,
            default_upscaler_model: None,
            edge_type: None
        });
    }

    let content = fs::read_to_string(settings_file)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(settings)
}

#[tauri::command]
async fn replicate_create_prediction(
    app_handle: tauri::AppHandle,
    model: String,
    input: serde_json::Value
) -> Result<ReplicatePrediction, String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured. Please add it in Settings.")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    // Parse model string to determine endpoint
    // Format can be: "owner/model", "owner/model:version", or just "version_id"
    let endpoint = if model.contains('/') {
        // owner/model or owner/model:version format
        let parts: Vec<&str> = model.splitn(2, ':').collect();
        let model_path = parts[0];

        if parts.len() == 2 {
            // Has version specified, use general predictions endpoint
            format!("https://api.replicate.com/v1/predictions")
        } else {
            // No version, use model-specific endpoint (official models only)
            format!("https://api.replicate.com/v1/models/{}/predictions", model_path)
        }
    } else {
        // Just a version ID, use general endpoint
        format!("https://api.replicate.com/v1/predictions")
    };

    // Build request body
    let request_body = if model.contains(':') || !model.contains('/') {
        // Include version in body
        serde_json::json!({
            "version": model,
            "input": input
        })
    } else {
        // No version, just input (for official models)
        serde_json::json!({
            "input": input
        })
    };

    println!("Creating prediction at: {}", endpoint);
    if cfg!(debug_assertions) {
        println!("Request body prepared for model: {}", model);
    }

    let response = client
        .post(&endpoint)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to create prediction: {}", e))?;

    let status = response.status();
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Replicate API error ({}): {}", status, response_text));
    }

    let prediction: ReplicatePrediction = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse prediction response: {} - Response: {}", e, response_text))?;

    Ok(prediction)
}

#[tauri::command]
async fn replicate_get_prediction(
    app_handle: tauri::AppHandle,
    prediction_id: String
) -> Result<ReplicatePrediction, String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    let url = format!("https://api.replicate.com/v1/predictions/{}", prediction_id);

    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to get prediction: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("Replicate API error: {}", error_text));
    }

    let prediction: ReplicatePrediction = response.json().await
        .map_err(|e| format!("Failed to parse prediction: {}", e))?;

    Ok(prediction)
}

#[tauri::command]
async fn replicate_cancel_prediction(
    app_handle: tauri::AppHandle,
    prediction_id: String
) -> Result<ReplicatePrediction, String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    let url = format!("https://api.replicate.com/v1/predictions/{}/cancel", prediction_id);

    let response = client
        .post(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to cancel prediction: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("Replicate API error: {}", error_text));
    }

    let prediction: ReplicatePrediction = response.json().await
        .map_err(|e| format!("Failed to parse prediction: {}", e))?;

    Ok(prediction)
}

#[tauri::command]
async fn replicate_get_model(
    app_handle: tauri::AppHandle,
    owner: String,
    model_name: String
) -> Result<ReplicateModel, String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured. Please add it in Settings.")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    let url = format!("https://api.replicate.com/v1/models/{}/{}", owner, model_name);

    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to get model: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("Replicate API error: {}", error_text));
    }

    let model: ReplicateModel = response.json().await
        .map_err(|e| format!("Failed to parse model: {}", e))?;

    Ok(model)
}

#[tauri::command]
async fn replicate_list_models(
    app_handle: tauri::AppHandle,
    collection_slug: Option<String>
) -> Result<ReplicateModelsResponse, String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured. Please add it in Settings.")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    // Use collection endpoint if collection_slug is provided, otherwise use general models endpoint
    if let Some(slug) = collection_slug {
        // Collection endpoint - returns all models in one response
        let url = format!("https://api.replicate.com/v1/collections/{}", slug);

        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Failed to list models: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await
                .map_err(|e| e.to_string())?;
            return Err(format!("Replicate API error: {}", error_text));
        }

        let response_text = response.text().await
            .map_err(|e| e.to_string())?;

        // Collection endpoint returns { models: [...] }
        let collection_data: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse collection response: {}", e))?;

        let models = collection_data["models"].as_array()
            .ok_or("Collection response missing models array")?;

        let parsed_models: Vec<ReplicateModel> = models.iter()
            .filter_map(|m| serde_json::from_value(m.clone()).ok())
            .collect();

        Ok(ReplicateModelsResponse {
            next: None,
            previous: None,
            results: parsed_models
        })
    } else {
        // General models endpoint - paginated, fetch multiple pages
        let mut all_models: Vec<ReplicateModel> = Vec::new();
        let mut next_url: Option<String> = Some("https://api.replicate.com/v1/models".to_string());
        let max_pages = 20; // Limit to ~2000 models to avoid timeout
        let mut page_count = 0;

        while let Some(url) = next_url {
            if page_count >= max_pages {
                break;
            }

            let response = client
                .get(&url)
                .headers(headers.clone())
                .send()
                .await
                .map_err(|e| format!("Failed to list models: {}", e))?;

            if !response.status().is_success() {
                let error_text = response.text().await
                    .map_err(|e| e.to_string())?;
                return Err(format!("Replicate API error: {}", error_text));
            }

            let response_text = response.text().await
                .map_err(|e| e.to_string())?;

            let page_response: ReplicateModelsResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Failed to parse models response: {}", e))?;

            all_models.extend(page_response.results);
            next_url = page_response.next;
            page_count += 1;
        }

        Ok(ReplicateModelsResponse {
            next: None,
            previous: None,
            results: all_models
        })
    }
}

#[tauri::command]
async fn replicate_upload_file(
    app_handle: tauri::AppHandle,
    file_path: String,
    filename: String,
    content_type: String
) -> Result<ReplicateFileUpload, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured")?;

    // Read the file
    let file_bytes = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Create multipart form
    let client = reqwest::Client::new();
    
    // Build the multipart form manually with proper boundaries
    let boundary = format!("----WebKitFormBoundary{}", chrono::Utc::now().timestamp());
    
    let mut body = Vec::new();
    
    // Add content field
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(format!("Content-Disposition: form-data; name=\"content\"; filename=\"{}\"\r\n", filename).as_bytes());
    body.extend_from_slice(format!("Content-Type: {}\r\n\r\n", content_type).as_bytes());
    body.extend_from_slice(&file_bytes);
    body.extend_from_slice(b"\r\n");
    
    // Add metadata field (empty object)
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"metadata\"\r\n");
    body.extend_from_slice(b"Content-Type: application/json\r\n\r\n");
    body.extend_from_slice(b"{}\r\n");
    
    // Add final boundary
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());
    
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_str(&format!("multipart/form-data; boundary={}", boundary))
            .map_err(|e| e.to_string())?
    );

    let response = client
        .post("https://api.replicate.com/v1/files")
        .headers(headers)
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Failed to upload file: {}", e))?;

    let status = response.status();
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Replicate API error ({}): {}", status, response_text));
    }

    let file_upload: ReplicateFileUpload = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse file upload response: {} - Response: {}", e, response_text))?;

    if cfg!(debug_assertions) {
        println!("File uploaded successfully:");
        println!("  ID: {}", file_upload.id);
        println!("  URL (urls.get): {}", file_upload.urls.get);
        println!("  Name: {}", file_upload.name);
    }

    Ok(file_upload)
}

#[tauri::command]
async fn replicate_delete_file(
    app_handle: tauri::AppHandle,
    file_id: String
) -> Result<(), String> {
    // Load settings to get API key
    let settings = load_settings(app_handle).await?;
    let api_key = settings.replicate_api_key
        .ok_or("Replicate API key not configured")?;

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?
    );

    let url = format!("https://api.replicate.com/v1/files/{}", file_id);

    let response = client
        .delete(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .map_err(|e| e.to_string())?;
        return Err(format!("Replicate API error: {}", error_text));
    }

    Ok(())
}

#[tauri::command]
async fn download_and_save_file(
    app_handle: tauri::AppHandle,
    url: String,
    filename: Option<String>,
    destination_folder: Option<String>
) -> Result<String, String> {
    // Download the file
    let client = reqwest::Client::new();
    
    // Check if this is a Replicate API URL and add auth header if needed
    let mut request = client.get(&url);
    
    if url.starts_with("https://api.replicate.com/") {
        // Load settings to get API key for Replicate file URLs
        let settings = load_settings(app_handle.clone()).await?;
        if let Some(api_key) = settings.replicate_api_key {
            let mut headers = HeaderMap::new();
            headers.insert(
                "Authorization",
                HeaderValue::from_str(&format!("Bearer {}", api_key))
                    .map_err(|e| format!("Failed to create auth header: {}", e))?
            );
            request = request.headers(headers);
            
            if cfg!(debug_assertions) {
                println!("Added Authorization header for Replicate file download");
            }
        } else {
            return Err("Replicate API key not configured but required for file download".to_string());
        }
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Download failed with status: {} - {}", status, error_body));
    }

    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read file bytes: {}", e))?;

    // Determine destination folder
    let dest_folder = resolve_destination_folder(&app_handle, destination_folder)?;

    // Create destination folder if it doesn't exist
    if !dest_folder.exists() {
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    // Determine filename
    let file_name = if let Some(name) = filename {
        sanitize_filename(&name)
    } else {
        // Extract filename from URL or generate one
        let timestamp = Utc::now().timestamp();

        // Try to get file extension from URL
        let raw_extension = url
            .split('?')
            .next()
            .and_then(|s| s.split('.').last())
            .unwrap_or("png");
        let extension = sanitize_extension(raw_extension);
        let extension = if extension.is_empty() { "png".to_string() } else { extension };

        sanitize_filename(&format!("noder-output-{}.{}", timestamp, extension))
    };

    let file_path = dest_folder.join(&file_name);

    // Save the file
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Return the absolute path as a string
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn read_file_as_base64(file_path: String) -> Result<String, String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose};

    // Read the file bytes
    let bytes = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect MIME type from file extension
    let mime_type = if file_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if file_path.to_lowercase().ends_with(".jpg") || file_path.to_lowercase().ends_with(".jpeg") {
        "image/jpeg"
    } else if file_path.to_lowercase().ends_with(".gif") {
        "image/gif"
    } else if file_path.to_lowercase().ends_with(".webp") {
        "image/webp"
    } else if file_path.to_lowercase().ends_with(".mp4") {
        "video/mp4"
    } else if file_path.to_lowercase().ends_with(".webm") {
        "video/webm"
    } else {
        "application/octet-stream"
    };

    // Encode to base64
    let base64_data = general_purpose::STANDARD.encode(&bytes);

    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[tauri::command]
async fn save_uploaded_file(
    app_handle: tauri::AppHandle,
    filename: String,
    data: String
) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};

    // Parse the data URL to extract the base64 data
    let base64_data = if data.starts_with("data:") {
        // Extract base64 part from data URL (format: data:mime/type;base64,...)
        data.split(',')
            .nth(1)
            .ok_or("Invalid data URL format")?
    } else {
        &data
    };

    // Decode base64 data
    let bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

    // Determine destination folder (use Downloads/noder/uploads)
    let download_dir = app_handle.path().download_dir()
        .map_err(|e| format!("Failed to get downloads directory: {}", e))?;
    let dest_folder = download_dir.join("noder").join("uploads");

    // Create destination folder if it doesn't exist
    if !dest_folder.exists() {
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    let safe_filename = sanitize_filename(&filename);

    // Generate unique filename if file already exists
    let mut file_path = dest_folder.join(&safe_filename);
    let mut counter = 1;
    let file_stem = std::path::Path::new(&safe_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let file_ext = std::path::Path::new(&safe_filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    while file_path.exists() {
        let new_filename = if file_ext.is_empty() {
            format!("{}_{}", file_stem, counter)
        } else {
            format!("{}_{}.{}", file_stem, counter, file_ext)
        };
        file_path = dest_folder.join(new_filename);
        counter += 1;
    }

    // Save the file
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Return the absolute path as a string
    Ok(file_path.to_string_lossy().to_string())
}

fn main() {
    let whatsapp_status = WhatsAppStatus {
        status: "initializing".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        is_authenticated: false,
        is_client_ready: false,
        is_initializing: true
    };

    let whatsapp_state = WhatsAppState(Arc::new(Mutex::new(whatsapp_status)));
    let whatsapp_state_clone = whatsapp_state.clone();

    Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(whatsapp_state_clone)
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Run init_whatsapp asynchronously
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<WhatsAppState>();
                if let Err(e) = init_whatsapp(handle.clone(), state).await {
                    eprintln!("Failed to initialize WhatsApp: {}", e);
                }
            });
            
            Ok(())
        })
        .invoke_handler(generate_handler![
            anthropic_request,
            openai_list_models,
            openai_chat_completion,
            save_workflow,
            list_workflows,
            load_workflow,
            rename_workflow,
            delete_workflow,
            create_workflow,
            send_whatsapp_message,
            get_whatsapp_status,
            init_whatsapp,
            listen_whatsapp_messages,
            stop_whatsapp_listener,
            save_settings,
            load_settings,
            replicate_create_prediction,
            replicate_get_prediction,
            replicate_cancel_prediction,
            replicate_get_model,
            replicate_list_models,
            replicate_upload_file,
            replicate_delete_file,
            fetch_github_release,
            download_update,
            apply_update,
            extract_app_zip,
            download_and_save_file,
            read_file_as_base64,
            save_uploaded_file
        ])
        .run(generate_context!())
        .expect("error while running tauri application");
}
