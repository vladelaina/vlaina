//! Tauri commands for GitHub Gist sync
//!
//! These commands are exposed to the frontend via Tauri's IPC.

use crate::github::{
    gist_api::GistClient,
    oauth::GitHubOAuthClient,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const DATA_FILE_NAME: &str = "data.json";
const NEKOTICK_FOLDER: &str = ".nekotick";
const GITHUB_CREDS_FILE: &str = "github_credentials.json";

/// GitHub OAuth config
#[derive(Debug, Clone, Deserialize)]
struct GitHubOAuthConfig {
    client_id: String,
    client_secret: String,
}

/// Load GitHub OAuth config from file or environment variables
fn load_oauth_config() -> Result<GitHubOAuthConfig, String> {
    // First try environment variables (for CI/CD)
    if let (Ok(client_id), Ok(client_secret)) = (
        std::env::var("DESKTOP_CLIENT_ID"),
        std::env::var("DESKTOP_CLIENT_SECRET"),
    ) {
        return Ok(GitHubOAuthConfig { client_id, client_secret });
    }

    // Then try config file (for local development)
    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("github_oauth.json");
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read github_oauth.json: {}. Create it from github_oauth.example.json", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse github_oauth.json: {}", e))
}

/// GitHub sync status returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSyncStatus {
    pub connected: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub gist_id: Option<String>,
    pub last_sync_time: Option<i64>,
    pub has_remote_data: bool,
    pub remote_modified_time: Option<String>,
}

/// GitHub auth result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAuthResult {
    pub success: bool,
    pub username: Option<String>,
    pub error: Option<String>,
}

/// GitHub sync result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSyncResult {
    pub success: bool,
    pub timestamp: Option<i64>,
    pub error: Option<String>,
}

/// GitHub bidirectional sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubBidirectionalSyncResult {
    pub success: bool,
    pub timestamp: Option<i64>,
    pub pulled_from_cloud: bool,
    pub pushed_to_cloud: bool,
    pub error: Option<String>,
}

/// PRO status check result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProStatusResult {
    pub is_pro: bool,
    pub license_key: Option<String>,
    pub expires_at: Option<i64>,
}

/// Remote data info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemoteDataInfo {
    pub exists: bool,
    pub modified_time: Option<String>,
    pub gist_id: Option<String>,
}

/// Stored GitHub credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
struct GitHubCredentials {
    access_token: String,
    username: String,
    #[serde(default)]
    avatar_url: Option<String>,
    gist_id: Option<String>,
}

/// GitHub sync metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct GitHubSyncMeta {
    last_sync_time: Option<i64>,
}

/// Get the data directory path
fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
}

/// Get GitHub credentials file path
fn get_github_creds_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push(GITHUB_CREDS_FILE);
    Ok(path)
}

/// Get GitHub sync metadata path
fn get_github_sync_meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push("github_sync_meta.json");
    Ok(path)
}

/// Load GitHub credentials
fn load_github_credentials(app: &tauri::AppHandle) -> Option<GitHubCredentials> {
    let path = get_github_creds_path(app).ok()?;
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Save GitHub credentials
fn save_github_credentials(app: &tauri::AppHandle, creds: &GitHubCredentials) -> Result<(), String> {
    let path = get_github_creds_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Delete GitHub credentials
fn delete_github_credentials(app: &tauri::AppHandle) -> Result<(), String> {
    let path = get_github_creds_path(app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get stored GitHub access token (public for use by other modules)
pub fn get_stored_github_token(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.access_token)
}

/// Get stored GitHub username (public for use by other modules)
pub fn get_stored_github_username(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.username)
}

/// Load GitHub sync metadata
fn load_github_sync_meta(app: &tauri::AppHandle) -> GitHubSyncMeta {
    if let Ok(path) = get_github_sync_meta_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(meta) = serde_json::from_str(&content) {
                return meta;
            }
        }
    }
    GitHubSyncMeta::default()
}

/// Save GitHub sync metadata
fn save_github_sync_meta(app: &tauri::AppHandle, meta: &GitHubSyncMeta) -> Result<(), String> {
    let path = get_github_sync_meta_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Start GitHub OAuth2 authorization flow
#[tauri::command]
pub async fn github_auth(app: tauri::AppHandle) -> Result<GitHubAuthResult, String> {
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;
    use socket2::{Socket, Domain, Type, Protocol};

    // Load OAuth config
    let oauth_config = load_oauth_config()?;

    // Use fixed port for GitHub OAuth (must match OAuth App callback URL)
    const CALLBACK_PORT: u16 = 8914;

    // Generate state for CSRF protection
    let state = GitHubOAuthClient::generate_state();

    // Create socket with SO_REUSEADDR to allow quick rebind
    let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
        .map_err(|e| format!("Failed to create socket: {}", e))?;
    
    socket.set_reuse_address(true)
        .map_err(|e| format!("Failed to set SO_REUSEADDR: {}", e))?;
    
    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", CALLBACK_PORT).parse().unwrap();
    socket.bind(&addr.into())
        .map_err(|e| format!("Failed to bind to port {}: {}. Port may be in use.", CALLBACK_PORT, e))?;
    
    socket.listen(1)
        .map_err(|e| format!("Failed to listen: {}", e))?;
    
    let listener: TcpListener = socket.into();

    // Build auth URL
    let oauth = GitHubOAuthClient::new(oauth_config.client_id.clone(), oauth_config.client_secret.clone());
    let auth_url = oauth.build_auth_url(&state, CALLBACK_PORT);

    // Create channel to receive the auth code
    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let state_clone = state.clone();

    // Start callback server in a separate thread
    thread::spawn(move || {
        if let Err(e) = listener.set_nonblocking(false) {
            let _ = tx.send(Err(format!("Failed to set blocking: {}", e)));
            return;
        }

        match GitHubOAuthClient::wait_for_callback(listener, &state_clone) {
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
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(format!("Failed to open browser: {}", e)),
        });
    }

    // Wait for the callback (with timeout)
    let code = match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(Ok(code)) => code,
        Ok(Err(e)) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(e),
            });
        }
        Err(_) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some("Authorization timed out".to_string()),
            });
        }
    };

    // Exchange code for tokens
    let tokens = match oauth.exchange_code(&code, CALLBACK_PORT).await {
        Ok(t) => t,
        Err(e) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(e.to_string()),
            });
        }
    };

    // Get user info
    let gist_client = GistClient::new(tokens.access_token.clone());
    let user_info = match gist_client.get_user_info().await {
        Ok(u) => u,
        Err(e) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(format!("Failed to get user info: {}", e)),
            });
        }
    };

    // Check for existing gist
    let existing_gist = gist_client.find_nekotick_gist().await.ok().flatten();

    // Store credentials
    let creds = GitHubCredentials {
        access_token: tokens.access_token,
        username: user_info.login.clone(),
        avatar_url: user_info.avatar_url.clone(),
        gist_id: existing_gist.map(|g| g.id),
    };

    if let Err(e) = save_github_credentials(&app, &creds) {
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(e),
        });
    }

    Ok(GitHubAuthResult {
        success: true,
        username: Some(user_info.login),
        error: None,
    })
}

/// Disconnect from GitHub
#[tauri::command]
pub async fn github_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    delete_github_credentials(&app)
}

/// Get current GitHub sync status
#[tauri::command]
pub async fn get_github_sync_status(app: tauri::AppHandle) -> Result<GitHubSyncStatus, String> {
    let sync_meta = load_github_sync_meta(&app);
    
    match load_github_credentials(&app) {
        Some(creds) => {
            let has_remote = creds.gist_id.is_some();
            Ok(GitHubSyncStatus {
                connected: true,
                username: Some(creds.username),
                avatar_url: creds.avatar_url,
                gist_id: creds.gist_id,
                last_sync_time: sync_meta.last_sync_time,
                has_remote_data: has_remote,
                remote_modified_time: None,
            })
        }
        None => Ok(GitHubSyncStatus {
            connected: false,
            username: None,
            avatar_url: None,
            gist_id: None,
            last_sync_time: None,
            has_remote_data: false,
            remote_modified_time: None,
        }),
    }
}

/// Check if remote data exists on GitHub
#[tauri::command]
pub async fn check_github_remote_data(app: tauri::AppHandle) -> Result<GitHubRemoteDataInfo, String> {
    let creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    let gist_client = GistClient::new(creds.access_token);

    // If we have a stored gist_id, check if it still exists
    if let Some(gist_id) = &creds.gist_id {
        match gist_client.get_gist(gist_id).await {
            Ok(gist) => {
                return Ok(GitHubRemoteDataInfo {
                    exists: true,
                    modified_time: Some(gist.updated_at),
                    gist_id: Some(gist.id),
                });
            }
            Err(_) => {
                // Gist might have been deleted, try to find another one
            }
        }
    }

    // Try to find existing gist
    match gist_client.find_nekotick_gist().await {
        Ok(Some(gist)) => Ok(GitHubRemoteDataInfo {
            exists: true,
            modified_time: Some(gist.updated_at),
            gist_id: Some(gist.id),
        }),
        Ok(None) => Ok(GitHubRemoteDataInfo {
            exists: false,
            modified_time: None,
            gist_id: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Sync local data to GitHub Gist
#[tauri::command]
pub async fn sync_to_github(app: tauri::AppHandle) -> Result<GitHubSyncResult, String> {
    let mut creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    let base_path = get_data_dir(&app)?;
    let data_json_path = base_path.join(NEKOTICK_FOLDER).join(DATA_FILE_NAME);

    if !data_json_path.exists() {
        return Ok(GitHubSyncResult {
            success: false,
            timestamp: None,
            error: Some("No local data to sync".to_string()),
        });
    }

    let content = fs::read_to_string(&data_json_path)
        .map_err(|e| format!("Failed to read data.json: {}", e))?;

    let gist_client = GistClient::new(creds.access_token.clone());
    
    // Upload to gist (create or update)
    let gist = gist_client
        .upload_data(creds.gist_id.as_deref(), &content)
        .await
        .map_err(|e| e.to_string())?;

    // Update stored gist_id if it was newly created
    if creds.gist_id.is_none() {
        creds.gist_id = Some(gist.id);
        save_github_credentials(&app, &creds)?;
    }

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = GitHubSyncMeta {
        last_sync_time: Some(now),
    };
    save_github_sync_meta(&app, &meta)?;

    Ok(GitHubSyncResult {
        success: true,
        timestamp: Some(now),
        error: None,
    })
}

/// Restore data from GitHub Gist
#[tauri::command]
pub async fn restore_from_github(app: tauri::AppHandle) -> Result<GitHubSyncResult, String> {
    let creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    let gist_id = creds.gist_id.as_ref()
        .ok_or("No remote gist found")?;

    let gist_client = GistClient::new(creds.access_token);
    
    // Download data from gist
    let content = gist_client
        .download_data(gist_id)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure local directory exists
    let base_path = get_data_dir(&app)?;
    let nekotick_dir = base_path.join(NEKOTICK_FOLDER);
    fs::create_dir_all(&nekotick_dir).map_err(|e| e.to_string())?;

    let data_json_path = nekotick_dir.join(DATA_FILE_NAME);
    let backup_path = nekotick_dir.join(format!("{}.backup", DATA_FILE_NAME));

    // Backup existing local data
    if data_json_path.exists() {
        fs::copy(&data_json_path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Write remote data to local
    if let Err(e) = fs::write(&data_json_path, &content) {
        // Restore from backup on failure
        if backup_path.exists() {
            let _ = fs::copy(&backup_path, &data_json_path);
        }
        return Err(format!("Failed to write data.json: {}", e));
    }

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = GitHubSyncMeta {
        last_sync_time: Some(now),
    };
    save_github_sync_meta(&app, &meta)?;

    Ok(GitHubSyncResult {
        success: true,
        timestamp: Some(now),
        error: None,
    })
}

/// Bidirectional sync with GitHub
#[tauri::command]
pub async fn sync_github_bidirectional(app: tauri::AppHandle) -> Result<GitHubBidirectionalSyncResult, String> {
    let mut creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    let base_path = get_data_dir(&app)?;
    let data_json_path = base_path.join(NEKOTICK_FOLDER).join(DATA_FILE_NAME);

    let gist_client = GistClient::new(creds.access_token.clone());

    let mut pulled_from_cloud = false;
    let mut pushed_to_cloud = false;

    // Get local modification time
    let local_modified = if data_json_path.exists() {
        fs::metadata(&data_json_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
    } else {
        None
    };

    // Check remote
    let remote_gist = if let Some(gist_id) = &creds.gist_id {
        gist_client.get_gist(gist_id).await.ok()
    } else {
        gist_client.find_nekotick_gist().await.ok().flatten()
    };

    // Pull from cloud if remote is newer
    if let Some(gist) = &remote_gist {
        let should_pull = match local_modified {
            Some(local_time) => {
                // Parse remote time (ISO 8601 format)
                if let Ok(remote_dt) = chrono::DateTime::parse_from_rfc3339(&gist.updated_at) {
                    remote_dt.timestamp() > local_time
                } else {
                    false
                }
            }
            None => true, // Remote exists, local doesn't
        };

        if should_pull {
            // Download remote data
            let content = gist_client
                .download_data(&gist.id)
                .await
                .map_err(|e| e.to_string())?;

            // Ensure local directory exists
            let nekotick_dir = base_path.join(NEKOTICK_FOLDER);
            fs::create_dir_all(&nekotick_dir).map_err(|e| e.to_string())?;

            // Backup existing local data
            if data_json_path.exists() {
                let backup_path = nekotick_dir.join(format!("{}.backup", DATA_FILE_NAME));
                let _ = fs::copy(&data_json_path, &backup_path);
            }

            // Write remote data to local
            fs::write(&data_json_path, &content)
                .map_err(|e| format!("Failed to write local data: {}", e))?;

            pulled_from_cloud = true;
        }
    }

    // Push local data to cloud
    if data_json_path.exists() {
        let content = fs::read_to_string(&data_json_path)
            .map_err(|e| format!("Failed to read data.json: {}", e))?;

        let gist = gist_client
            .upload_data(creds.gist_id.as_deref(), &content)
            .await
            .map_err(|e| e.to_string())?;

        // Update stored gist_id if it was newly created
        if creds.gist_id.is_none() {
            creds.gist_id = Some(gist.id);
            save_github_credentials(&app, &creds)?;
        }

        pushed_to_cloud = true;
    }

    // Update sync metadata
    let now = chrono::Utc::now().timestamp();
    let meta = GitHubSyncMeta {
        last_sync_time: Some(now),
    };
    save_github_sync_meta(&app, &meta)?;

    Ok(GitHubBidirectionalSyncResult {
        success: true,
        timestamp: Some(now),
        pulled_from_cloud,
        pushed_to_cloud,
        error: None,
    })
}


/// Check PRO status from cloud API
#[tauri::command]
pub async fn check_pro_status(app: tauri::AppHandle) -> Result<ProStatusResult, String> {
    let creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    // Call cloud API to check PRO status
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.nekotick.com/check_pro")
        .json(&serde_json::json!({
            "github_username": creds.username
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to check PRO status: {}", e))?;

    if !response.status().is_success() {
        return Ok(ProStatusResult {
            is_pro: false,
            license_key: None,
            expires_at: None,
        });
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let is_pro = data.get("isPro").and_then(|v| v.as_bool()).unwrap_or(false);
    let license_key = data.get("licenseKey").and_then(|v| v.as_str()).map(String::from);
    let expires_at = data.get("expiresAt").and_then(|v| v.as_i64());

    Ok(ProStatusResult {
        is_pro,
        license_key,
        expires_at,
    })
}

/// Bind license key to GitHub account
#[tauri::command]
pub async fn bind_license_key(app: tauri::AppHandle, license_key: String) -> Result<ProStatusResult, String> {
    let creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    // Call cloud API to bind license
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.nekotick.com/bind_license")
        .json(&serde_json::json!({
            "license_key": license_key,
            "github_username": creds.username
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to bind license: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        let expires_at = data.get("expiresAt").and_then(|v| v.as_i64());
        Ok(ProStatusResult {
            is_pro: true,
            license_key: Some(license_key),
            expires_at,
        })
    } else {
        let error_code = data.get("error_code").and_then(|v| v.as_str()).unwrap_or("UNKNOWN");
        Err(format!("Bind failed: {}", error_code))
    }
}
