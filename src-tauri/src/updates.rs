use std::fs;
use std::io::{self, Read};
use std::path::Path;
use std::process::Command;

use reqwest::header::USER_AGENT;
use sha2::{Digest, Sha256};
use tauri::Manager;

use crate::path_utils::{sanitize_component, sanitize_filename};

const MAX_UPDATE_MANIFEST_BYTES: u64 = 1024 * 1024;

fn escape_powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "macos")]
fn escape_bash_literal(value: &str) -> String {
    value.replace('\'', "'\\''")
}

#[tauri::command]
pub async fn fetch_github_release(repo: String) -> Result<serde_json::Value, String> {
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
pub async fn fetch_update_manifest(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header(USER_AGENT, "noder-updater")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch checksum manifest: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Checksum manifest download failed ({}): {}",
            status, error_text
        ));
    }

    if response.content_length().unwrap_or(0) > MAX_UPDATE_MANIFEST_BYTES {
        return Err("Checksum manifest is too large.".to_string());
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read checksum manifest: {}", e))?;

    if body.len() as u64 > MAX_UPDATE_MANIFEST_BYTES {
        return Err("Checksum manifest is too large.".to_string());
    }

    Ok(body)
}

#[tauri::command]
pub async fn download_update(
    app_handle: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
    dir_name: Option<String>,
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

    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to write update file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

fn normalize_sha256(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.len() == 64 && normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
        Some(normalized)
    } else {
        None
    }
}

fn calculate_sha256(file_path: &Path) -> Result<String, io::Error> {
    let mut file = fs::File::open(file_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub fn verify_update_sha256(file_path: String, expected_sha256: String) -> Result<(), String> {
    let expected = normalize_sha256(&expected_sha256).ok_or_else(|| {
        "Expected SHA-256 checksum must be 64 hexadecimal characters.".to_string()
    })?;

    let update_file = Path::new(&file_path);
    if !update_file.exists() {
        return Err("Update file not found.".to_string());
    }

    let actual = calculate_sha256(update_file)
        .map_err(|e| format!("Failed to calculate update checksum: {}", e))?;
    if actual != expected {
        return Err("Update checksum mismatch.".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn apply_update(app: tauri::AppHandle, update_path: String) -> Result<(), String> {
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
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ])
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
pub fn extract_app_zip(zip_path: String) -> Result<String, String> {
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
pub fn extract_app_zip(_zip_path: String) -> Result<String, String> {
    Err("This command is only available on macOS".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_update(contents: &[u8]) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "noder-update-sha256-test-{}-{}.bin",
            std::process::id(),
            nonce
        ));
        fs::write(&path, contents).expect("temp update should be written");
        path
    }

    #[test]
    fn verify_update_sha256_accepts_matching_digest() {
        let path = write_temp_update(b"hello");

        let result = verify_update_sha256(
            path.to_string_lossy().to_string(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824".to_string(),
        );

        fs::remove_file(path).ok();
        assert!(result.is_ok());
    }

    #[test]
    fn verify_update_sha256_rejects_mismatched_digest() {
        let path = write_temp_update(b"hello");

        let result = verify_update_sha256(path.to_string_lossy().to_string(), "0".repeat(64));

        fs::remove_file(path).ok();
        assert_eq!(result.unwrap_err(), "Update checksum mismatch.");
    }

    #[test]
    fn verify_update_sha256_rejects_invalid_digest() {
        let path = write_temp_update(b"hello");

        let result =
            verify_update_sha256(path.to_string_lossy().to_string(), "not-a-sha".to_string());

        fs::remove_file(path).ok();
        assert_eq!(
            result.unwrap_err(),
            "Expected SHA-256 checksum must be 64 hexadecimal characters."
        );
    }
}
