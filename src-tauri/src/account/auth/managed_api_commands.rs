use crate::account::credentials::get_stored_app_session_token;
use serde_json::Value;
use tauri::ipc::Channel;

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

#[derive(Clone, serde::Serialize)]
pub struct ManagedChatStreamEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

fn parse_stream_delta(line: &str) -> Option<ManagedChatStreamEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed == "data: [DONE]" || !trimmed.starts_with("data: ") {
        return None;
    }

    let payload: Value = serde_json::from_str(trimmed.trim_start_matches("data: ")).ok()?;
    let delta = payload.get("choices")?.get(0)?.get("delta")?;
    let reasoning = delta
        .get("reasoning_content")
        .and_then(Value::as_str)
        .or_else(|| delta.get("reasoning").and_then(Value::as_str))
        .map(str::to_string);
    let content = delta.get("content").and_then(Value::as_str).map(str::to_string);

    if reasoning.is_none() && content.is_none() {
        return None;
    }

    Some(ManagedChatStreamEvent { reasoning, content })
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

#[tauri::command]
pub async fn managed_chat_completion_stream(
    app: tauri::AppHandle,
    body: Value,
    on_event: Channel<ManagedChatStreamEvent>,
) -> Result<Value, String> {
    let session_token = require_managed_session_token(&app)?;
    let client = reqwest::Client::new();
    let response = client
        .post(managed_chat_completions_url())
        .bearer_auth(&session_token)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Managed API request failed: {}", e))?;

    persist_rotated_session_token_from_headers(&app, response.headers())?;

    let status = response.status();
    if !status.is_success() {
        let raw_body = response
            .text()
            .await
            .unwrap_or_else(|_| String::from("Failed to read managed API response"));
        return Err(format!(
            "Managed API failed with status {}: {}",
            status.as_u16(),
            raw_body
        ));
    }

    let mut response = response;
    let mut buffer = String::new();

    while let Some(bytes) = response
        .chunk()
        .await
        .map_err(|e| format!("Failed to read managed API stream: {}", e))?
    {
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(index) = buffer.find('\n') {
            let line = buffer[..index].to_string();
            buffer.drain(..=index);

            if let Some(event) = parse_stream_delta(&line) {
                on_event
                    .send(event)
                    .map_err(|e| format!("Failed to forward managed API stream event: {}", e))?;
            }
        }
    }

    if let Some(event) = parse_stream_delta(&buffer) {
        on_event
            .send(event)
            .map_err(|e| format!("Failed to forward managed API stream event: {}", e))?;
    }

    Ok(serde_json::json!({ "success": true }))
}
