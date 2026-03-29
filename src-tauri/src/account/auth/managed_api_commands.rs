use crate::account::credentials::get_stored_app_session_token;
use futures_util::StreamExt;
use serde_json::Value;
use tauri::Emitter;

use super::{
    session_state::{
        invalidate_account_auth, is_managed_session_invalid, managed_api_error_message,
        MANAGED_API_SESSION_EXPIRED_ERROR,
    },
    worker_api::{persist_rotated_session_token_from_headers, read_api_base_url},
};

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

fn managed_chat_stream_chunk_event(request_id: &str) -> String {
    format!("managed-chat-stream:{}:chunk", request_id)
}

fn managed_chat_stream_done_event(request_id: &str) -> String {
    format!("managed-chat-stream:{}:done", request_id)
}

fn managed_chat_stream_error_event(request_id: &str) -> String {
    format!("managed-chat-stream:{}:error", request_id)
}

fn require_managed_session_token(app: &tauri::AppHandle) -> Result<String, String> {
    get_stored_app_session_token(app)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            invalidate_account_auth(app);
            "vlaina sign-in required".to_string()
        })
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
        if is_managed_session_invalid(status, &raw_body) {
            invalidate_account_auth(app);
            return Err(MANAGED_API_SESSION_EXPIRED_ERROR.to_string());
        }
        return Err(managed_api_error_message(status, &raw_body));
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

#[tauri::command]
pub async fn managed_chat_completion_stream(
    app: tauri::AppHandle,
    request_id: String,
    body: Value,
) -> Result<(), String> {
    let session_token = require_managed_session_token(&app)?;
    let client = reqwest::Client::new();
    let chunk_event = managed_chat_stream_chunk_event(&request_id);
    let done_event = managed_chat_stream_done_event(&request_id);
    let error_event = managed_chat_stream_error_event(&request_id);
    let mut payload = body;
    if let Some(map) = payload.as_object_mut() {
        map.insert("stream".to_string(), Value::Bool(true));
    }

    let response = match client
        .post(managed_chat_completions_url())
        .bearer_auth(session_token)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await
    {
        Ok(value) => value,
        Err(error) => {
            let message = format!("Managed API request failed: {}", error);
            let _ = app.emit(&error_event, message.clone());
            return Err(message);
        }
    };

    persist_rotated_session_token_from_headers(&app, response.headers())?;

    let status = response.status();
    if !status.is_success() {
        let raw_body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read managed API response: {}", e))?;
        let message = if is_managed_session_invalid(status, &raw_body) {
            invalidate_account_auth(&app);
            MANAGED_API_SESSION_EXPIRED_ERROR.to_string()
        } else {
            managed_api_error_message(status, &raw_body)
        };
        let _ = app.emit(&error_event, message.clone());
        return Err(message);
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut has_started_reasoning = false;
    let mut has_finished_reasoning = false;

    while let Some(next) = stream.next().await {
        let bytes = match next {
            Ok(value) => value,
            Err(error) => {
                let message = format!("Managed API stream failed: {}", error);
                let _ = app.emit(&error_event, message.clone());
                return Err(message);
            }
        };

        let text = match std::str::from_utf8(&bytes) {
            Ok(value) => value,
            Err(error) => {
                let message = format!("Managed API stream was not valid utf-8: {}", error);
                let _ = app.emit(&error_event, message.clone());
                return Err(message);
            }
        };
        buffer.push_str(text);

        while let Some(position) = buffer.find('\n') {
            let line = buffer[..position].trim().to_string();
            buffer.drain(..=position);

            if line.is_empty() || line == "data: [DONE]" {
                continue;
            }

            if !line.starts_with("data: ") {
                continue;
            }

            let json_str = &line[6..];
            let payload: Value = match serde_json::from_str(json_str) {
                Ok(value) => value,
                Err(_) => continue,
            };

            let delta = payload
                .get("choices")
                .and_then(Value::as_array)
                .and_then(|choices| choices.first())
                .and_then(|choice| choice.get("delta"));

            let reasoning = delta
                .and_then(|delta| delta.get("reasoning_content"))
                .and_then(Value::as_str);
            let content = delta
                .and_then(|delta| delta.get("content"))
                .and_then(Value::as_str);

            if let Some(reasoning) = reasoning {
                if !has_started_reasoning {
                    full_content.push_str("<think>");
                    has_started_reasoning = true;
                }
                full_content.push_str(reasoning);
            }

            if let Some(content) = content {
                if has_started_reasoning && !has_finished_reasoning {
                    full_content.push_str("</think>");
                    has_finished_reasoning = true;
                }
                full_content.push_str(content);
            }

            if reasoning.is_some() || content.is_some() {
                let _ = app.emit(&chunk_event, full_content.clone());
            }
        }
    }

    if has_started_reasoning && !has_finished_reasoning {
        full_content.push_str("</think>");
    }

    let _ = app.emit(&done_event, full_content);
    Ok(())
}
