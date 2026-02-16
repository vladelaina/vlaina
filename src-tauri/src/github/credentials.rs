use crate::github::types::GitHubSyncMeta;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub const NEKOTICK_FOLDER: &str = ".nekotick";
pub const STORE_FOLDER: &str = "store";
pub const GITHUB_CREDS_FILE: &str = "github_credentials.json";
pub const CONFIG_REPO_NAME: &str = "nekotick-config";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct GitHubCredentials {
    pub access_token: String,
    pub username: String,
    #[serde(default)]
    pub github_id: Option<u64>,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitHubOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

pub fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
}

fn get_github_creds_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push(STORE_FOLDER);
    path.push(GITHUB_CREDS_FILE);
    Ok(path)
}

fn get_github_sync_meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push(STORE_FOLDER);
    path.push("github_sync_meta.json");
    Ok(path)
}

pub fn load_github_credentials(app: &tauri::AppHandle) -> Option<GitHubCredentials> {
    let path = get_github_creds_path(app).ok()?;
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn save_github_credentials(app: &tauri::AppHandle, creds: &GitHubCredentials) -> Result<(), String> {
    let path = get_github_creds_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn delete_github_credentials(app: &tauri::AppHandle) -> Result<(), String> {
    let path = get_github_creds_path(app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_stored_github_token(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.access_token)
}

pub fn get_stored_github_username(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.username)
}

pub fn save_github_sync_meta(app: &tauri::AppHandle, meta: &GitHubSyncMeta) -> Result<(), String> {
    let path = get_github_sync_meta_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn load_github_sync_meta(app: &tauri::AppHandle) -> GitHubSyncMeta {
    if let Ok(path) = get_github_sync_meta_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(meta) = serde_json::from_str(&content) {
                return meta;
            }
        }
    }
    GitHubSyncMeta::default()
}

pub fn load_oauth_config() -> Result<GitHubOAuthConfig, String> {
    if let (Ok(client_id), Ok(client_secret)) = (
        std::env::var("DESKTOP_CLIENT_ID"),
        std::env::var("DESKTOP_CLIENT_SECRET"),
    ) {
        return Ok(GitHubOAuthConfig { client_id, client_secret });
    }

    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("github_oauth.json");
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read github_oauth.json: {}. Create it from github_oauth.example.json", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse github_oauth.json: {}", e))
}
