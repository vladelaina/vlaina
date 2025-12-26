//! Tauri commands for Google Drive sync
//!
//! These commands are exposed to the frontend via Tauri's IPC.

use crate::credentials::{CredentialStore, StoredCredentials};
use crate::google_drive::{
    drive_api::DriveClient,
    oauth::OAuthClient,
};
use crate::license::device_id::DeviceIdGenerator;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// Google OAuth credentials from Google Cloud Console
const GOOGLE_CLIENT_ID: &str = "743009558942-gj6kv6infeeuf5rcu9m7oickbfedh0s7.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET: &str = "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";

const DATA_FILE_NAME: &str = "data.json";
const NEKOTICK_FOLDER: &str = ".nekotick";
const MARKDOWN_FILE: &str = "nekotick.md";

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

/// Get credential store for the app
fn get_credential_store(app: &tauri::AppHandle) -> Result<CredentialStore, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(CredentialStore::new(&app_data_dir, device_id))
}

/// Get stored credentials, refreshing token if needed
async fn get_valid_credentials(app: &tauri::AppHandle) -> Result<StoredCredentials, String> {
    let store = get_credential_store(app)?;
    let mut creds = store.load().map_err(|e| e.to_string())?;

    // Refresh token if expiring
    if creds.is_token_expiring() {
        let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
        if let Ok(new_tokens) = oauth.refresh_token(&creds.refresh_token).await {
            let new_expires_at = chrono::Utc::now().timestamp() + new_tokens.expires_in as i64;
            creds.update_access_token(new_tokens.access_token, new_expires_at);
            let _ = store.save(&creds);
        }
    }

    Ok(creds)
}

/// Start Google OAuth2 PKCE authorization flow
#[tauri::command]
pub async fn google_drive_auth(app: tauri::AppHandle) -> Result<AuthResult, String> {
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

    // Store tokens using encrypted credential store
    let store = get_credential_store(&app)?;
    let stored = StoredCredentials::new(
        store.get_device_id().to_string(),
        tokens.access_token,
        tokens.refresh_token.unwrap_or_default(),
        chrono::Utc::now().timestamp() + tokens.expires_in as i64,
        user_info.as_ref().map(|u| u.email.clone()),
        None,
    );

    if let Err(e) = store.save(&stored) {
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
pub async fn google_drive_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    let store = get_credential_store(&app)?;
    store.delete().map_err(|e| e.to_string())
}

/// Get current sync status
#[tauri::command]
pub async fn get_sync_status(app: tauri::AppHandle) -> Result<SyncStatus, String> {
    let sync_meta = load_sync_meta(&app);
    
    // Try to get credentials from encrypted store
    let store = get_credential_store(&app)?;
    let creds = match store.load() {
        Ok(c) => Some(c),
        Err(e) => {
            eprintln!("Failed to get credentials: {}", e);
            None
        }
    };

    match creds {
        Some(mut c) => {
            // Check if we need to refresh token
            if c.is_token_expiring() {
                // Try to refresh
                let oauth = OAuthClient::new(GOOGLE_CLIENT_ID.to_string(), GOOGLE_CLIENT_SECRET.to_string());
                if let Ok(new_tokens) = oauth.refresh_token(&c.refresh_token).await {
                    let new_expires_at = chrono::Utc::now().timestamp() + new_tokens.expires_in as i64;
                    c.update_access_token(new_tokens.access_token, new_expires_at);
                    let _ = store.save(&c);
                }
            }

            Ok(SyncStatus {
                connected: true,
                user_email: c.user_email,
                last_sync_time: sync_meta.last_sync_time,
                has_remote_data: false, // Will be checked separately
                remote_modified_time: None,
                folder_id: c.folder_id,
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
pub async fn check_remote_data(app: tauri::AppHandle) -> Result<RemoteDataInfo, String> {
    let store = get_credential_store(&app)?;
    let mut creds = get_valid_credentials(&app).await?;

    let drive = DriveClient::new(creds.access_token.clone());

    // Get or create folder
    let folder_id = match creds.folder_id.clone() {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            creds.update_folder_id(id.clone());
            let _ = store.save(&creds);
            id
        }
    };

    // Check for .nekotick subfolder
    match drive.find_file(&folder_id, NEKOTICK_FOLDER).await {
        Ok(Some(nekotick_folder)) => {
            // Check for data.json inside .nekotick
            match drive.find_file(&nekotick_folder.id, DATA_FILE_NAME).await {
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
        Ok(None) => Ok(RemoteDataInfo {
            exists: false,
            modified_time: None,
            file_id: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Sync local data to Google Drive (manual sync - always available)
/// 
/// Syncs the entire directory structure:
/// - NekoTick_Data/
///   - .nekotick/
///     - data.json
///   - nekotick.md
#[tauri::command]
pub async fn sync_to_drive(app: tauri::AppHandle) -> Result<SyncResult, String> {
    let store = get_credential_store(&app)?;
    let mut creds = get_valid_credentials(&app).await?;

    let base_path = get_data_dir(&app)?;
    let drive = DriveClient::new(creds.access_token.clone());

    // Get or create app folder (NekoTick_Data)
    let app_folder_id = match creds.folder_id.clone() {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            creds.update_folder_id(id.clone());
            let _ = store.save(&creds);
            id
        }
    };

    // Create .nekotick subfolder in Drive
    let nekotick_folder_id = drive
        .ensure_subfolder(&app_folder_id, NEKOTICK_FOLDER)
        .await
        .map_err(|e| e.to_string())?;

    // Upload .nekotick/data.json
    let data_json_path = base_path.join(NEKOTICK_FOLDER).join(DATA_FILE_NAME);
    if data_json_path.exists() {
        let content = fs::read(&data_json_path)
            .map_err(|e| format!("Failed to read {}: {}", DATA_FILE_NAME, e))?;
        drive
            .upload_file(&nekotick_folder_id, DATA_FILE_NAME, &content)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Upload nekotick.md (in root of NekoTick_Data)
    let md_path = base_path.join(MARKDOWN_FILE);
    if md_path.exists() {
        let content = fs::read(&md_path)
            .map_err(|e| format!("Failed to read {}: {}", MARKDOWN_FILE, e))?;
        drive
            .upload_file(&app_folder_id, MARKDOWN_FILE, &content)
            .await
            .map_err(|e| e.to_string())?;
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

/// Restore data from Google Drive
/// 
/// Restores the entire directory structure:
/// - .nekotick/data.json
/// - nekotick.md
#[tauri::command]
pub async fn restore_from_drive(app: tauri::AppHandle) -> Result<SyncResult, String> {
    let store = get_credential_store(&app)?;
    let mut creds = get_valid_credentials(&app).await?;

    let base_path = get_data_dir(&app)?;
    let drive = DriveClient::new(creds.access_token.clone());

    // Get app folder ID
    let app_folder_id = match creds.folder_id.clone() {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            creds.update_folder_id(id.clone());
            let _ = store.save(&creds);
            id
        }
    };

    // Find .nekotick subfolder
    let nekotick_folder = drive
        .find_file(&app_folder_id, NEKOTICK_FOLDER)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No remote .nekotick folder found")?;

    // Find and download data.json
    let data_file = drive
        .find_file(&nekotick_folder.id, DATA_FILE_NAME)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No remote data.json found")?;

    let data_content = drive
        .download_file(&data_file.id)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure local .nekotick directory exists
    let nekotick_dir = base_path.join(NEKOTICK_FOLDER);
    fs::create_dir_all(&nekotick_dir).map_err(|e| e.to_string())?;

    // Backup and write data.json
    let data_json_path = nekotick_dir.join(DATA_FILE_NAME);
    let backup_path = nekotick_dir.join(format!("{}.backup", DATA_FILE_NAME));

    if data_json_path.exists() {
        fs::copy(&data_json_path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    if let Err(e) = fs::write(&data_json_path, &data_content) {
        // Restore from backup on failure
        if backup_path.exists() {
            let _ = fs::copy(&backup_path, &data_json_path);
        }
        return Err(format!("Failed to write data.json: {}", e));
    }

    // Try to download and restore nekotick.md (optional)
    if let Ok(Some(md_file)) = drive.find_file(&app_folder_id, MARKDOWN_FILE).await {
        if let Ok(md_content) = drive.download_file(&md_file.id).await {
            let md_path = base_path.join(MARKDOWN_FILE);
            let _ = fs::write(&md_path, &md_content);
        }
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


/// Auto sync to Google Drive (PRO feature - requires active PRO status)
/// 
/// This is the entry point for automatic sync. It checks PRO status before syncing.
/// Uses bidirectional sync to ensure multi-device consistency.
/// Manual sync (sync_to_drive) is always available regardless of PRO status.
#[tauri::command]
pub async fn auto_sync_to_drive(app: tauri::AppHandle) -> Result<BidirectionalSyncResult, String> {
    use crate::license::manager::LicenseManager;

    // Check PRO status
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let license_manager = LicenseManager::new(app_data_dir).map_err(|e| e.to_string())?;
    let status = license_manager.get_status();

    if !status.is_pro {
        if status.time_tamper_detected {
            return Err("系统时间异常，请校准时间后重试".to_string());
        }
        return Err("自动同步是 PRO 功能，请先激活或开始试用".to_string());
    }

    // PRO status valid, proceed with bidirectional sync for multi-device consistency
    sync_bidirectional(app).await
}

/// Bidirectional sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidirectionalSyncResult {
    pub success: bool,
    pub timestamp: Option<i64>,
    pub pulled_from_cloud: bool,
    pub pushed_to_cloud: bool,
    pub error: Option<String>,
}

/// Bidirectional sync - pulls from cloud if newer, then pushes local changes
/// 
/// This is for free users who want to manually sync.
/// Strategy:
/// 1. Compare local and remote modification times
/// 2. If remote is newer, download and merge (currently: replace local)
/// 3. Upload local data to cloud
/// 
/// Note: Currently uses "last write wins" strategy. Future versions may implement
/// proper conflict resolution.
#[tauri::command]
pub async fn sync_bidirectional(app: tauri::AppHandle) -> Result<BidirectionalSyncResult, String> {
    let store = get_credential_store(&app)?;
    let mut creds = get_valid_credentials(&app).await?;

    let base_path = get_data_dir(&app)?;
    let drive = DriveClient::new(creds.access_token.clone());

    // Get or create app folder
    let app_folder_id = match creds.folder_id.clone() {
        Some(id) => id,
        None => {
            let id = drive.ensure_app_folder().await.map_err(|e| e.to_string())?;
            creds.update_folder_id(id.clone());
            let _ = store.save(&creds);
            id
        }
    };

    let mut pulled_from_cloud = false;
    let mut pushed_to_cloud = false;

    // Step 1: Check if remote data exists and compare timestamps
    let local_data_path = base_path.join(NEKOTICK_FOLDER).join(DATA_FILE_NAME);
    let local_modified = if local_data_path.exists() {
        fs::metadata(&local_data_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
    } else {
        None
    };

    // Check remote
    let remote_info = match drive.find_file(&app_folder_id, NEKOTICK_FOLDER).await {
        Ok(Some(nekotick_folder)) => {
            match drive.find_file(&nekotick_folder.id, DATA_FILE_NAME).await {
                Ok(Some(file)) => Some((nekotick_folder.id, file)),
                _ => None,
            }
        }
        _ => None,
    };

    // Step 2: Pull from cloud if remote is newer
    if let Some((_nekotick_folder_id, remote_file)) = &remote_info {
        let should_pull = match (&remote_file.modified_time, local_modified) {
            (Some(remote_time), Some(local_time)) => {
                // Parse remote time (ISO 8601 format)
                if let Ok(remote_dt) = chrono::DateTime::parse_from_rfc3339(remote_time) {
                    remote_dt.timestamp() > local_time
                } else {
                    false
                }
            }
            (Some(_), None) => true, // Remote exists, local doesn't
            _ => false,
        };

        if should_pull {
            // Download remote data
            let remote_content = drive
                .download_file(&remote_file.id)
                .await
                .map_err(|e| e.to_string())?;

            // Ensure local directory exists
            let nekotick_dir = base_path.join(NEKOTICK_FOLDER);
            fs::create_dir_all(&nekotick_dir).map_err(|e| e.to_string())?;

            // Backup existing local data
            if local_data_path.exists() {
                let backup_path = nekotick_dir.join(format!("{}.backup", DATA_FILE_NAME));
                let _ = fs::copy(&local_data_path, &backup_path);
            }

            // Write remote data to local
            fs::write(&local_data_path, &remote_content)
                .map_err(|e| format!("Failed to write local data: {}", e))?;

            pulled_from_cloud = true;
        }
    }

    // Step 3: Push local data to cloud
    // Create .nekotick subfolder in Drive if needed
    let nekotick_folder_id = drive
        .ensure_subfolder(&app_folder_id, NEKOTICK_FOLDER)
        .await
        .map_err(|e| e.to_string())?;

    // Upload data.json
    if local_data_path.exists() {
        let content = fs::read(&local_data_path)
            .map_err(|e| format!("Failed to read {}: {}", DATA_FILE_NAME, e))?;
        drive
            .upload_file(&nekotick_folder_id, DATA_FILE_NAME, &content)
            .await
            .map_err(|e| e.to_string())?;
        pushed_to_cloud = true;
    }

    // Upload nekotick.md
    let md_path = base_path.join(MARKDOWN_FILE);
    if md_path.exists() {
        let content = fs::read(&md_path)
            .map_err(|e| format!("Failed to read {}: {}", MARKDOWN_FILE, e))?;
        drive
            .upload_file(&app_folder_id, MARKDOWN_FILE, &content)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = SyncMeta {
        last_sync_time: Some(now),
    };
    save_sync_meta(&app, &meta)?;

    Ok(BidirectionalSyncResult {
        success: true,
        timestamp: Some(now),
        pulled_from_cloud,
        pushed_to_cloud,
        error: None,
    })
}
