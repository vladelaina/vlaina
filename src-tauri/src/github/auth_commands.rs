use crate::github::{
    config_sync,
    credentials::{
        delete_github_credentials, load_github_credentials, load_github_sync_meta,
        save_github_credentials, GitHubCredentials,
    },
    types::{GitHubAuthResult, GitHubSyncStatus},
};
use serde::Deserialize;
use std::time::Duration;
use tokio::time::{sleep, Instant};

const DEFAULT_API_BASE_URL: &str = "https://api.nekotick.com";
const DEFAULT_POLL_INTERVAL_MS: u64 = 1500;
const MIN_POLL_INTERVAL_MS: u64 = 500;
const MAX_POLL_INTERVAL_MS: u64 = 5000;
const DEFAULT_AUTH_TIMEOUT_SECONDS: u64 = 300;
const MAX_AUTH_TIMEOUT_SECONDS: u64 = 900;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerAuthStartResponse {
    auth_url: String,
    state: String,
    poll_interval_ms: Option<u64>,
    expires_in_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerAuthResultResponse {
    success: bool,
    pending: Option<bool>,
    access_token: Option<String>,
    github_id: Option<u64>,
    username: Option<String>,
    avatar_url: Option<String>,
    error: Option<String>,
}

fn read_api_base_url() -> String {
    std::env::var("NEKOTICK_API_BASE_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_API_BASE_URL.to_string())
}

fn desktop_auth_start_url() -> String {
    format!("{}/auth/github/desktop/start", read_api_base_url())
}

fn desktop_auth_result_url() -> String {
    format!("{}/auth/github/desktop/result", read_api_base_url())
}

async fn request_worker_auth_start() -> Result<WorkerAuthStartResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(desktop_auth_start_url())
        .send()
        .await
        .map_err(|e| format!("Failed to start OAuth via API: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read OAuth start response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "OAuth start API failed with status {}: {}",
            status.as_u16(),
            body
        ));
    }

    let payload: WorkerAuthStartResponse =
        serde_json::from_str(&body).map_err(|e| format!("Invalid OAuth start response: {}", e))?;

    if payload.auth_url.trim().is_empty() || payload.state.trim().is_empty() {
        return Err("OAuth start response is missing authUrl or state".to_string());
    }

    Ok(payload)
}

async fn poll_worker_auth_result(state: &str) -> Result<WorkerAuthResultResponse, String> {
    let mut endpoint = reqwest::Url::parse(&desktop_auth_result_url())
        .map_err(|e| format!("Invalid desktop result endpoint: {}", e))?;
    endpoint.query_pairs_mut().append_pair("state", state);

    let client = reqwest::Client::new();
    let response = client
        .get(endpoint)
        .send()
        .await
        .map_err(|e| format!("Failed to poll OAuth result via API: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read OAuth result response: {}", e))?;

    let payload: WorkerAuthResultResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Invalid OAuth result response: {}", e))?;

    if !status.is_success() && !payload.pending.unwrap_or(false) {
        return Err(payload.error.unwrap_or_else(|| {
            format!("OAuth result API failed with status {}", status.as_u16())
        }));
    }

    Ok(payload)
}

#[tauri::command]
pub async fn github_auth(app: tauri::AppHandle) -> Result<GitHubAuthResult, String> {
    let start = match request_worker_auth_start().await {
        Ok(payload) => payload,
        Err(error) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(error),
            });
        }
    };

    if let Err(error) = open::that(&start.auth_url) {
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(format!("Failed to open browser: {}", error)),
        });
    }

    let poll_interval = start
        .poll_interval_ms
        .unwrap_or(DEFAULT_POLL_INTERVAL_MS)
        .clamp(MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
    let timeout_seconds = start
        .expires_in_seconds
        .unwrap_or(DEFAULT_AUTH_TIMEOUT_SECONDS)
        .clamp(DEFAULT_AUTH_TIMEOUT_SECONDS, MAX_AUTH_TIMEOUT_SECONDS);
    let deadline = Instant::now() + Duration::from_secs(timeout_seconds);
    let mut consecutive_poll_errors = 0u8;

    let result = loop {
        let poll = match poll_worker_auth_result(&start.state).await {
            Ok(payload) => {
                consecutive_poll_errors = 0;
                payload
            }
            Err(error) => {
                consecutive_poll_errors = consecutive_poll_errors.saturating_add(1);
                if Instant::now() >= deadline || consecutive_poll_errors >= 5 {
                    return Ok(GitHubAuthResult {
                        success: false,
                        username: None,
                        error: Some(error),
                    });
                }
                sleep(Duration::from_millis(poll_interval)).await;
                continue;
            }
        };

        if poll.success {
            break poll;
        }

        if poll.pending.unwrap_or(false) {
            if Instant::now() >= deadline {
                return Ok(GitHubAuthResult {
                    success: false,
                    username: None,
                    error: Some("Authorization timed out".to_string()),
                });
            }
            sleep(Duration::from_millis(poll_interval)).await;
            continue;
        }

        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(poll.error.unwrap_or_else(|| "OAuth failed".to_string())),
        });
    };

    let access_token = match result.access_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some("OAuth result missing accessToken".to_string()),
            });
        }
    };

    let username = match result.username {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some("OAuth result missing username".to_string()),
            });
        }
    };

    let creds = GitHubCredentials {
        access_token: access_token.clone(),
        username: username.clone(),
        github_id: result.github_id,
        avatar_url: result.avatar_url,
    };

    if let Err(error) = save_github_credentials(&app, &creds) {
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(error),
        });
    }

    let token_for_config = access_token;
    let username_for_config = username.clone();
    tokio::spawn(async move {
        let _ = config_sync::ensure_config_repo(&token_for_config, &username_for_config).await;
    });

    Ok(GitHubAuthResult {
        success: true,
        username: Some(username),
        error: None,
    })
}

#[tauri::command]
pub async fn github_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    delete_github_credentials(&app)
}

#[tauri::command]
pub async fn get_github_sync_status(app: tauri::AppHandle) -> Result<GitHubSyncStatus, String> {
    let sync_meta = load_github_sync_meta(&app);

    match load_github_credentials(&app) {
        Some(creds) => {
            let config_ready = config_sync::check_config_remote(&app)
                .await
                .map(|(exists, _)| exists)
                .unwrap_or(false);
            Ok(GitHubSyncStatus {
                connected: true,
                username: Some(creds.username),
                avatar_url: creds.avatar_url,
                config_repo_ready: config_ready,
                last_sync_time: sync_meta.last_sync_time,
                has_remote_data: config_ready,
                remote_modified_time: None,
            })
        }
        None => Ok(GitHubSyncStatus {
            connected: false,
            username: None,
            avatar_url: None,
            config_repo_ready: false,
            last_sync_time: None,
            has_remote_data: false,
            remote_modified_time: None,
        }),
    }
}
