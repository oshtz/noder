use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue};
use tauri::Manager;

use crate::path_utils::{sanitize_extension, sanitize_filename, sanitize_relative_path};
use crate::settings::load_settings;

fn resolve_destination_folder(
    app_handle: &tauri::AppHandle,
    destination_folder: Option<String>,
) -> Result<PathBuf, String> {
    let download_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get downloads directory: {}", e))?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
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
            return Err(
                "Destination folder must be within Downloads or app data directory.".to_string(),
            );
        }

        let relative = sanitize_relative_path(trimmed);
        if relative.as_os_str().is_empty() {
            return Ok(base_dir);
        }

        let first_segment = relative
            .components()
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
pub async fn download_and_save_file(
    app_handle: tauri::AppHandle,
    url: String,
    filename: Option<String>,
    destination_folder: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    if url.starts_with("https://api.replicate.com/") {
        let settings = load_settings(app_handle.clone()).await?;
        if let Some(api_key) = settings.replicate_api_key {
            let mut headers = HeaderMap::new();
            headers.insert(
                "Authorization",
                HeaderValue::from_str(&format!("Bearer {}", api_key))
                    .map_err(|e| format!("Failed to create auth header: {}", e))?,
            );
            request = request.headers(headers);

            if cfg!(debug_assertions) {
                println!("Added Authorization header for Replicate file download");
            }
        } else {
            return Err(
                "Replicate API key not configured but required for file download".to_string(),
            );
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Download failed with status: {} - {}",
            status, error_body
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read file bytes: {}", e))?;

    let dest_folder = resolve_destination_folder(&app_handle, destination_folder)?;

    if !dest_folder.exists() {
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    let file_name = if let Some(name) = filename {
        sanitize_filename(&name)
    } else {
        let timestamp = Utc::now().timestamp();

        let raw_extension = url
            .split('?')
            .next()
            .and_then(|s| s.split('.').last())
            .unwrap_or("png");
        let extension = sanitize_extension(raw_extension);
        let extension = if extension.is_empty() {
            "png".to_string()
        } else {
            extension
        };

        sanitize_filename(&format!("noder-output-{}.{}", timestamp, extension))
    };

    let file_path = dest_folder.join(&file_name);

    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_file_as_base64(file_path: String) -> Result<String, String> {
    let bytes = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let mime_type = if file_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if file_path.to_lowercase().ends_with(".jpg")
        || file_path.to_lowercase().ends_with(".jpeg")
    {
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

    let base64_data = general_purpose::STANDARD.encode(&bytes);

    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[tauri::command]
pub async fn save_uploaded_file(
    app_handle: tauri::AppHandle,
    filename: String,
    data: String,
) -> Result<String, String> {
    let base64_data = if data.starts_with("data:") {
        data.split(',').nth(1).ok_or("Invalid data URL format")?
    } else {
        &data
    };

    let bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

    let download_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get downloads directory: {}", e))?;
    let dest_folder = download_dir.join("noder").join("uploads");

    if !dest_folder.exists() {
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    let safe_filename = sanitize_filename(&filename);

    let mut file_path = dest_folder.join(&safe_filename);
    let mut counter = 1;
    let file_stem = Path::new(&safe_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let file_ext = Path::new(&safe_filename)
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

    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
