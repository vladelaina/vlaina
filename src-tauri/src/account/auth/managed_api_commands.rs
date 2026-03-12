use crate::account::credentials::get_stored_app_session_token;
use serde_json::Value;

use super::worker_api::{persist_rotated_session_token_from_headers, read_api_base_url};

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
    app: &tauri::AppHandle,
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

    persist_rotated_session_token_from_headers(app, response.headers())?;

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

#[tauri::command]
pub async fn get_managed_models(app: tauri::AppHandle) -> Result<Value, String> {
    let session_token = require_managed_session_token(&app)?;
    request_managed_json(
        &app,
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
        &app,
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
        &app,
        &session_token,
        reqwest::Method::POST,
        managed_chat_completions_url(),
        Some(&body),
    )
    .await
}
