use crate::github::{
    config_sync,
    credentials::{delete_github_credentials, save_github_credentials, GitHubCredentials},
    types::{GitHubAuthResult, GitHubSyncStatus},
};

use super::{
    browser::open_auth_url,
    oauth_api::{request_worker_auth_start, wait_for_worker_auth_result},
    status::get_github_sync_status_impl,
};

fn error_result(error: String) -> GitHubAuthResult {
    GitHubAuthResult {
        success: false,
        username: None,
        error: Some(error),
    }
}

#[tauri::command]
pub async fn github_auth(app: tauri::AppHandle) -> Result<GitHubAuthResult, String> {
    let start = match request_worker_auth_start().await {
        Ok(payload) => payload,
        Err(error) => return Ok(error_result(error)),
    };

    if let Err(error) = open_auth_url(&start.auth_url) {
        return Ok(error_result(error));
    }

    let result = match wait_for_worker_auth_result(
        &start.state,
        start.poll_interval_ms,
        start.expires_in_seconds,
    )
    .await
    {
        Ok(payload) => payload,
        Err(error) => return Ok(error_result(error)),
    };

    let access_token = match result.access_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => return Ok(error_result("OAuth result missing accessToken".to_string())),
    };

    let username = match result.username {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => return Ok(error_result("OAuth result missing username".to_string())),
    };

    let creds = GitHubCredentials {
        access_token: access_token.clone(),
        username: username.clone(),
        github_id: result.github_id,
        avatar_url: result.avatar_url,
    };

    if let Err(error) = save_github_credentials(&app, &creds) {
        return Ok(error_result(error));
    }

    let token_for_config = access_token;
    let username_for_config = username.clone();
    tokio::spawn(async move {
        let _ = config_sync::sync_config_repo_ready(&token_for_config, &username_for_config).await;
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
    get_github_sync_status_impl(&app).await
}
