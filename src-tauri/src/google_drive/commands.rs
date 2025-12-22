//! Tauri commands for Google Drive sync
//!
//! These commands are exposed to the frontend via Tauri's IPC.

use crate::google_drive::{
    drive_api::DriveClient,
    keyring_store::{StoredTokens, TokenManager},
    oauth::OAuthClient,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// Google OAuth credentials from Google Cloud Console
const GOOGLE_CLIENT_ID: &str = "743009558942-gj6kv6infeeuf5rcu9m7oickbfedh0s7.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET: &str = "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";

const DATA_FILE_NAME: &str = "data.json";

/// Sync status returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub connected: bool,
    pub user_email: Option<String>,
    pub last_sync_time: Option<i64>,
    pub has_remote_data: bool,
    pub remote_modified_time: Option<String>,
    pub folder_id: Option<String>,
}

/// Auth result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub success: bool,
    pub user_email: Option<String>,
    pub error: Option<String>,
}

/// Sync result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub timestamp: Option<i64>,
    pub error: Option<String>,
}

/// Remote data info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDataInfo {
    pub exists: bool,
    pub modified_time: Option<String>,
    pub file_id: Option<String>,
}

/// Get the data directory path
fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
}

/// Get sync metadata path
fn get_sync_meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(".nekotick");
    path.push("sync_meta.json");
    Ok(path)
}

/// Sync metadata stored locally
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SyncMeta {
    last_sync_time: Option<i64>,
}

fn load_sync_meta(app: &tauri::AppHandle) -> SyncMeta {
    if let Ok(path) = get_sync_meta_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(meta) = serde_json::from_str(&content) {
                return meta;
            }
        }
    }
    SyncMeta::default()
}

fn save_sync_meta(app: &tauri::AppHandle, meta: &SyncMeta) -> Result<(), String> {
    let path = get_sync_meta_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Start Google OAuth2 PKCE authorization flow
#[tauri::command]
pub async fn google_drive_auth(_app: tauri::AppHandle) -> Result<AuthResult, String> {
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;

    // Generate PKCE parameters
    let verifier = OAuthClient::generate_code_verifier();
    let challenge = OAuthClient::compute_code_challenge(&verifier);
    let state = OAuthClient::generate_code_verifier(); // Use as random state

    // First, bind to a port to get the port number
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind to port: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    // Build auth URL
    let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
    let auth_url = oauth.build_auth_url(&challenge, &state, port);

    // Create channel to receive the auth code
    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let state_clone = state.clone();

    // Start callback server in a separate thread
    thread::spawn(move || {
        // Set timeout for the listener
        if let Err(e) = listener.set_nonblocking(false) {
            let _ = tx.send(Err(format!("Failed to set blocking: {}", e)));
            return;
        }

        match OAuthClient::wait_for_callback(listener, &state_clone) {
            Ok(code) => {
                let _ = tx.send(Ok(code));
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
        }
    });

    // Open browser AFTER starting the server
    if let Err(e) = open::that(&auth_url) {
        return Ok(AuthResult {
            success: false,
            user_email: None,
            error: Some(format!("Failed to open browser: {}", e)),
        });
    }

    // Wait for the callback (with timeout)
    let code = match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(Ok(code)) => code,
        Ok(Err(e)) => {
            return Ok(AuthResult {
                success: false,
                user_email: None,
                error: Some(e),
            });
        }
        Err(_) => {
            return Ok(AuthResult {
                success: false,
                user_email: None,
                error: Some("Authorization timed out".to_string()),
            });
        }
    };

    // Exchange code for tokens
    let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
    let tokens = match oauth.exchange_code(&code, &verifier, port).await {
        Ok(t) => t,
        Err(e) => {
            return Ok(AuthResult {
                success: false,
                user_email: None,
                error: Some(e.to_string()),
            });
        }
    };

    // Get user info
    let drive = DriveClient::new(tokens.access_token.clone());
    let user_info = drive.get_user_info().await.ok();

    // Store tokens
    let stored = StoredTokens {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token.unwrap_or_default(),
        expires_at: chrono::Utc::now().timestamp() + tokens.expires_in as i64,
        user_email: user_info.as_ref().map(|u| u.email.clone()),
        folder_id: None,
    };

    if let Err(e) = TokenManager::store_tokens(&stored) {
        return Ok(AuthResult {
            success: false,
            user_email: None,
            error: Some(e.to_string()),
        });
    }

    Ok(AuthResult {
        success: true,
        user_email: user_info.map(|u| u.email),
        error: None,
    })
}

/// Disconnect from Google Drive
#[tauri::command]
pub async fn google_drive_disconnect() -> Result<(), String> {
    TokenManager::clear_tokens().map_err(|e| e.to_string())
}

/// Get current sync status
#[tauri::command]
pub async fn get_sync_status(app: tauri::AppHandle) -> Result<SyncStatus, String> {
    let sync_meta = load_sync_meta(&app);
    
    // Try to get tokens, handle errors gracefully
    let tokens = match TokenManager::get_tokens() {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Failed to get tokens from keyring: {}", e);
            None
        }
    };

    match tokens {
        Some(t) => {
            // Check if we need to refresh token
            if TokenManager::is_token_expiring(&t) {
                // Try to refresh
                let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
                if let Ok(new_tokens) = oauth.refresh_token(&t.refresh_token).await {
                    let _ = TokenManager::update_access_token(
                        &new_tokens.access_token,
                        new_tokens.expires_in,
                    );
                }
            }

            Ok(SyncStatus {
                connected: true,
                user_email: t.user_email,
                last_sync_time: sync_meta.last_sync_time,
                has_remote_data: false, // Will be checked separately
                remote_modified_time: None,
                folder_id: t.folder_id,
            })
        }
        None => Ok(SyncStatus {
            connected: false,
            user_email: None,
            last_sync_time: None,
            has_remote_data: false,
            remote_modified_time: None,
            folder_id: None,
        }),
    }
}

/// Check if remote data exists
#[tauri::command]
pub async fn check_remote_data() -> Result<RemoteDataInfo, String> {
    let mut tokens = TokenManager::get_tokens()
        .map_err(|e| e.to_string())?
        .ok_or("Not connected")?;

    // Refresh token if expiring
    if TokenManager::is_token_expiring(&tokens) {
        let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
        if let Ok(new_tokens) = oauth.refresh_token(&tokens.refresh_token).await {
            let _ = TokenManager::update_access_token(&new_tokens.access_token, new_tokens.expires_in);
            tokens.access_token = new_tokens.access_token;
        }
    }

    let drive = DriveClient::new(tokens.access_token);

    // Get or create folder
    let folder_id = match tokens.folder_id {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            let _ = TokenManager::update_folder_id(&id);
            id
        }
    };

    // Check for data file
    match drive.find_file(&folder_id, DATA_FILE_NAME).await {
        Ok(Some(file)) => Ok(RemoteDataInfo {
            exists: true,
            modified_time: file.modified_time,
            file_id: Some(file.id),
        }),
        Ok(None) => Ok(RemoteDataInfo {
            exists: false,
            modified_time: None,
            file_id: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Sync local data to Google Drive
#[tauri::command]
pub async fn sync_to_drive(app: tauri::AppHandle) -> Result<SyncResult, String> {
    let mut tokens = TokenManager::get_tokens()
        .map_err(|e| e.to_string())?
        .ok_or("Not connected")?;

    // Refresh token if expiring
    if TokenManager::is_token_expiring(&tokens) {
        let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
        if let Ok(new_tokens) = oauth.refresh_token(&tokens.refresh_token).await {
            let _ = TokenManager::update_access_token(&new_tokens.access_token, new_tokens.expires_in);
            tokens.access_token = new_tokens.access_token;
        }
    }

    // Read local data file
    let mut data_path = get_data_dir(&app)?;
    data_path.push(".nekotick");
    data_path.push(DATA_FILE_NAME);

    let content = fs::read(&data_path).map_err(|e| format!("Failed to read local data: {}", e))?;

    let drive = DriveClient::new(tokens.access_token);

    // Get or create folder
    let folder_id = match tokens.folder_id {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            let _ = TokenManager::update_folder_id(&id);
            id
        }
    };

    // Upload file
    drive
        .upload_file(&folder_id, DATA_FILE_NAME, &content)
        .await
        .map_err(|e| e.to_string())?;

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = SyncMeta {
        last_sync_time: Some(now),
    };
    save_sync_meta(&app, &meta)?;

    Ok(SyncResult {
        success: true,
        timestamp: Some(now),
        error: None,
    })
}

/// Restore data from Google Drive
#[tauri::command]
pub async fn restore_from_drive(app: tauri::AppHandle) -> Result<SyncResult, String> {
    let mut tokens = TokenManager::get_tokens()
        .map_err(|e| e.to_string())?
        .ok_or("Not connected")?;

    // Refresh token if expiring
    if TokenManager::is_token_expiring(&tokens) {
        let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
        if let Ok(new_tokens) = oauth.refresh_token(&tokens.refresh_token).await {
            let _ = TokenManager::update_access_token(&new_tokens.access_token, new_tokens.expires_in);
            tokens.access_token = new_tokens.access_token;
        }
    }

    let drive = DriveClient::new(tokens.access_token);

    // Get folder ID
    let folder_id = match tokens.folder_id {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            let _ = TokenManager::update_folder_id(&id);
            id
        }
    };

    // Find remote file
    let file = drive
        .find_file(&folder_id, DATA_FILE_NAME)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No remote data found")?;

    // Download content
    let content = drive
        .download_file(&file.id)
        .await
        .map_err(|e| e.to_string())?;

    // Backup current local data
    let mut data_path = get_data_dir(&app)?;
    data_path.push(".nekotick");
    fs::create_dir_all(&data_path).map_err(|e| e.to_string())?;
    
    let data_file = data_path.join(DATA_FILE_NAME);
    let backup_file = data_path.join(format!("{}.backup", DATA_FILE_NAME));

    if data_file.exists() {
        fs::copy(&data_file, &backup_file)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Write new data
    if let Err(e) = fs::write(&data_file, &content) {
        // Restore from backup on failure
        if backup_file.exists() {
            let _ = fs::copy(&backup_file, &data_file);
        }
        return Err(format!("Failed to write data: {}", e));
    }

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = SyncMeta {
        last_sync_time: Some(now),
    };
    save_sync_meta(&app, &meta)?;

    Ok(SyncResult {
        success: true,
        timestamp: Some(now),
        error: None,
    })
}
