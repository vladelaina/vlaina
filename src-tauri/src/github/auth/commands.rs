use crate::github::{
    config_sync,
    credentials::{
        delete_github_credentials, get_stored_app_session_token, save_github_credentials,
        GitHubCredentials,
    },
    types::{GitHubAuthResult, GitHubSyncStatus},
};
use serde_json::Value;

use super::{
    browser::open_auth_url,
    oauth_api::{read_api_base_url, request_worker_auth_start, wait_for_worker_auth_result},
    status::get_github_sync_status_impl,
};

fn error_result(error: String) -> GitHubAuthResult {
    GitHubAuthResult {
        success: false,
        username: None,
        error: Some(error),
    }
}

fn session_revoke_url() -> String {
    format!("{}/auth/session/revoke", read_api_base_url())
}

fn managed_api_base_url() -> String {
    format!("{}/v1", read_api_base_url())
}

fn managed_models_url() -> String {
    format!("{}/models", managed_api_base_url())
}

fn managed_budget_url() -> String {
    format!("{}/budget", managed_api_base_url())
}

fn managed_chat_completions_url() -> String {
    format!("{}/chat/completions", managed_api_base_url())
}

fn require_managed_session_token(app: &tauri::AppHandle) -> Result<String, String> {
    get_stored_app_session_token(app)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "NekoTick sign-in required".to_string())
}

async fn request_managed_json(
    session_token: &str,
    method: reqwest::Method,
    url: String,
    body: Option<&Value>,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let mut request = client
        .request(method, &url)
        .bearer_auth(session_token)
        .header(reqwest::header::ACCEPT, "application/json");

    if let Some(payload) = body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(payload);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Managed API request failed: {}", e))?;

    let status = response.status();
    let raw_body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read managed API response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "Managed API failed with status {}: {}",
            status.as_u16(),
            raw_body
        ));
    }

    serde_json::from_str(&raw_body).map_err(|e| format!("Invalid managed API response: {}", e))
}

async fn revoke_worker_session(session_token: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(session_revoke_url())
        .bearer_auth(session_token)
        .send()
        .await
        .map_err(|e| format!("Failed to revoke Worker session: {}", e))?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| String::from("Failed to read revoke response"));
    Err(format!(
        "Worker session revoke failed with status {}: {}",
        status.as_u16(),
        body
    ))
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

    let app_session_token = match result.session_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Ok(error_result(
                "OAuth result missing sessionToken".to_string(),
            ))
        }
    };

    let access_token = match result.github_access_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Ok(error_result(
                "OAuth result missing githubAccessToken".to_string(),
            ))
        }
    };

    let username = match result.username {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => return Ok(error_result("OAuth result missing username".to_string())),
    };

    let creds = GitHubCredentials {
        access_token: access_token.clone(),
        app_session_token: Some(app_session_token),
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
    if let Some(session_token) = get_stored_app_session_token(&app) {
        if let Err(error) = revoke_worker_session(&session_token).await {
            eprintln!("{}", error);
        }
    }
    delete_github_credentials(&app)
}

#[tauri::command]
pub async fn get_github_sync_status(app: tauri::AppHandle) -> Result<GitHubSyncStatus, String> {
    get_github_sync_status_impl(&app).await
}

#[tauri::command]
pub async fn get_managed_models(app: tauri::AppHandle) -> Result<Value, String> {
    let session_token = require_managed_session_token(&app)?;
    request_managed_json(
        &session_token,
        reqwest::Method::GET,
        managed_models_url(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn get_managed_budget(app: tauri::AppHandle) -> Result<Value, String> {
    let session_token = require_managed_session_token(&app)?;
    request_managed_json(
        &session_token,
        reqwest::Method::GET,
        managed_budget_url(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn managed_chat_completion(app: tauri::AppHandle, body: Value) -> Result<Value, String> {
    let session_token = require_managed_session_token(&app)?;
    request_managed_json(
        &session_token,
        reqwest::Method::POST,
        managed_chat_completions_url(),
        Some(&body),
    )
    .await
}
