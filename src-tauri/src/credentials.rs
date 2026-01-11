use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credential {
    pub id: String,
    pub name: String,
    pub value: String,
    pub credential_type: String,
}

fn get_credentials_dir(app_handle: &AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap()
        .join("credentials")
}

#[tauri::command]
pub async fn list_credentials_command(app_handle: AppHandle) -> Result<Vec<Credential>, String> {
    let credentials_dir = get_credentials_dir(&app_handle);
    if !credentials_dir.exists() {
        fs::create_dir_all(&credentials_dir).map_err(|e| e.to_string())?;
        return Ok(Vec::new());
    }

    let mut credentials = Vec::new();
    for entry in fs::read_dir(&credentials_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
            let credential: Credential = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            credentials.push(credential);
        }
    }
    Ok(credentials)
}

#[tauri::command]
pub async fn save_credential_command(app_handle: AppHandle, credential: Credential) -> Result<(), String> {
    let credentials_dir = get_credentials_dir(&app_handle);
    if !credentials_dir.exists() {
        fs::create_dir_all(&credentials_dir).map_err(|e| e.to_string())?;
    }

    let file_path = credentials_dir.join(format!("{}.json", credential.id));
    let content = serde_json::to_string_pretty(&credential).map_err(|e| e.to_string())?;
    fs::write(file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_credential_command(app_handle: AppHandle, id: String) -> Result<(), String> {
    let credentials_dir = get_credentials_dir(&app_handle);
    let file_path = credentials_dir.join(format!("{}.json", id));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
