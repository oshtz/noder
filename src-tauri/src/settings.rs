use std::fs;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const KEYRING_SERVICE: &str = "com.oshtz.noder";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FloatingButtonPosition {
    x: f32,
    y: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub replicate_api_key: Option<String>,
    pub fal_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub openrouter_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub ollama_base_url: Option<String>,
    pub lm_studio_base_url: Option<String>,
    pub default_save_location: Option<String>,
    pub show_templates: Option<bool>,
    pub show_assistant_panel: Option<bool>,
    pub show_editor_toolbar: Option<bool>,
    pub run_button_unlocked: Option<bool>,
    pub run_button_position: Option<FloatingButtonPosition>,
    pub default_text_model: Option<String>,
    pub default_image_model: Option<String>,
    pub default_video_model: Option<String>,
    pub default_audio_model: Option<String>,
    pub default_upscaler_model: Option<String>,
    pub edge_type: Option<String>,
    pub default_text_provider: Option<String>,
    pub default_image_provider: Option<String>,
    pub default_video_provider: Option<String>,
    pub default_audio_provider: Option<String>,
    pub default_upscaler_provider: Option<String>,
}

fn default_app_settings() -> AppSettings {
    AppSettings {
        replicate_api_key: None,
        fal_api_key: None,
        openai_api_key: None,
        openrouter_api_key: None,
        anthropic_api_key: None,
        gemini_api_key: None,
        ollama_base_url: Some("http://localhost:11434".to_string()),
        lm_studio_base_url: Some("http://localhost:1234".to_string()),
        default_save_location: None,
        show_templates: None,
        show_assistant_panel: None,
        show_editor_toolbar: None,
        run_button_unlocked: None,
        run_button_position: None,
        default_text_model: None,
        default_image_model: None,
        default_video_model: None,
        default_audio_model: None,
        default_upscaler_model: None,
        edge_type: None,
        default_text_provider: None,
        default_image_provider: None,
        default_video_provider: None,
        default_audio_provider: None,
        default_upscaler_provider: None,
    }
}

fn has_plaintext_api_keys(settings: &AppSettings) -> bool {
    settings
        .replicate_api_key
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
        || settings
            .fal_api_key
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || settings
            .openai_api_key
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || settings
            .openrouter_api_key
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || settings
            .anthropic_api_key
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || settings
            .gemini_api_key
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
}

fn strip_api_keys(settings: &mut AppSettings) {
    settings.replicate_api_key = None;
    settings.fal_api_key = None;
    settings.openai_api_key = None;
    settings.openrouter_api_key = None;
    settings.anthropic_api_key = None;
    settings.gemini_api_key = None;
}

fn keyring_entry(name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, name)
        .map_err(|e| format!("Failed to open secure storage entry '{}': {}", name, e))
}

fn load_api_key(name: &str) -> Result<Option<String>, String> {
    match keyring_entry(name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read '{}' from secure storage: {}", name, e)),
    }
}

fn save_api_key(name: &str, value: Option<&String>) -> Result<(), String> {
    let entry = keyring_entry(name)?;
    match value.map(|entry| entry.trim()).filter(|entry| !entry.is_empty()) {
        Some(secret) => entry
            .set_password(secret)
            .map_err(|e| format!("Failed to save '{}' to secure storage: {}", name, e)),
        None => match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to remove '{}' from secure storage: {}", name, e)),
        },
    }
}

fn save_api_keys(settings: &AppSettings) -> Result<(), String> {
    save_api_key("replicate_api_key", settings.replicate_api_key.as_ref())?;
    save_api_key("fal_api_key", settings.fal_api_key.as_ref())?;
    save_api_key("openai_api_key", settings.openai_api_key.as_ref())?;
    save_api_key("openrouter_api_key", settings.openrouter_api_key.as_ref())?;
    save_api_key("anthropic_api_key", settings.anthropic_api_key.as_ref())?;
    save_api_key("gemini_api_key", settings.gemini_api_key.as_ref())
}

fn load_api_keys(settings: &mut AppSettings) -> Result<(), String> {
    settings.replicate_api_key = load_api_key("replicate_api_key")?;
    settings.fal_api_key = load_api_key("fal_api_key")?;
    settings.openai_api_key = load_api_key("openai_api_key")?;
    settings.openrouter_api_key = load_api_key("openrouter_api_key")?;
    settings.anthropic_api_key = load_api_key("anthropic_api_key")?;
    settings.gemini_api_key = load_api_key("gemini_api_key")?;
    Ok(())
}

#[tauri::command]
pub async fn save_settings(
    app_handle: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let settings_file = app_data.join("settings.json");
    save_api_keys(&settings)?;

    let mut persisted_settings = settings;
    strip_api_keys(&mut persisted_settings);

    let json = serde_json::to_string_pretty(&persisted_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(settings_file, json).map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let settings_file = app_data.join("settings.json");

    if !settings_file.exists() {
        let mut settings = default_app_settings();
        load_api_keys(&mut settings)?;
        return Ok(settings);
    }

    let content = fs::read_to_string(&settings_file)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let mut settings: AppSettings =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?;

    if has_plaintext_api_keys(&settings) {
        save_api_keys(&settings)?;
        let mut persisted_settings = settings.clone();
        strip_api_keys(&mut persisted_settings);
        let json = serde_json::to_string_pretty(&persisted_settings)
            .map_err(|e| format!("Failed to serialize migrated settings: {}", e))?;
        fs::write(&settings_file, json)
            .map_err(|e| format!("Failed to write migrated settings file: {}", e))?;
    }

    load_api_keys(&mut settings)?;

    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_non_empty_plaintext_api_keys() {
        let mut settings = default_app_settings();
        assert!(!has_plaintext_api_keys(&settings));

        settings.replicate_api_key = Some("   ".to_string());
        assert!(!has_plaintext_api_keys(&settings));

        settings.replicate_api_key = Some("replicate-token".to_string());
        assert!(has_plaintext_api_keys(&settings));
    }

    #[test]
    fn strip_api_keys_removes_all_secret_fields() {
        let mut settings = default_app_settings();
        settings.replicate_api_key = Some("replicate-token".to_string());
        settings.fal_api_key = Some("fal-token".to_string());
        settings.openai_api_key = Some("openai-token".to_string());
        settings.openrouter_api_key = Some("openrouter-token".to_string());
        settings.anthropic_api_key = Some("anthropic-token".to_string());
        settings.gemini_api_key = Some("gemini-token".to_string());

        strip_api_keys(&mut settings);

        assert!(settings.replicate_api_key.is_none());
        assert!(settings.fal_api_key.is_none());
        assert!(settings.openai_api_key.is_none());
        assert!(settings.openrouter_api_key.is_none());
        assert!(settings.anthropic_api_key.is_none());
        assert!(settings.gemini_api_key.is_none());
    }
}
