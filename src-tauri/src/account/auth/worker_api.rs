use crate::account::credentials::update_stored_app_session_token;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration, Instant};

const DEFAULT_API_BASE_URL: &str = "https://api.vlaina.com";
const DEFAULT_AUTH_RESULT_RETRY_MS: u64 = 200;
const MAX_AUTH_RESULT_RETRY_MS: u64 = 1000;
const DEFAULT_AUTH_TIMEOUT_SECONDS: u64 = 300;
const MAX_AUTH_TIMEOUT_SECONDS: u64 = 900;
pub(crate) const APP_SESSION_HEADER: &str = "x-app-session-token";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerAuthStartResponse {
    pub success: bool,
    pub auth_url: String,
    pub state: String,
    pub expires_in_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerAuthResultResponse {
    pub success: bool,
    pub pending: Option<bool>,
    pub provider: Option<String>,
    pub session_token: Option<String>,
    pub username: Option<String>,
    pub primary_email: Option<String>,
    pub avatar_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAuthStartBody<'a> {
    callback_url: &'a str,
    verifier: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAuthResultBody<'a> {
    state: &'a str,
    verifier: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EmailCodeRequestBody<'a> {
    email: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EmailCodeVerifyBody<'a> {
    email: &'a str,
    code: &'a str,
    target: &'a str,
}

pub fn read_api_base_url() -> String {
    std::env::var("APP_API_BASE_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_API_BASE_URL.to_string())
}

fn desktop_auth_start_url(provider: &str) -> String {
    format!("{}/auth/{}/desktop/start", read_api_base_url(), provider)
}

fn desktop_auth_result_url(provider: &str) -> String {
    format!("{}/auth/{}/desktop/result", read_api_base_url(), provider)
}

fn email_request_code_url() -> String {
    format!("{}/auth/email/request-code", read_api_base_url())
}

fn email_verify_code_url() -> String {
    format!("{}/auth/email/verify-code", read_api_base_url())
}

pub(crate) fn persist_rotated_session_token_from_headers(
    app: &tauri::AppHandle,
    headers: &HeaderMap,
) -> Result<(), String> {
    if let Some(rotated_token) = headers
        .get(APP_SESSION_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        update_stored_app_session_token(app, rotated_token.to_string())
            .map_err(|error| format!("Failed to persist rotated session token: {}", error))?;
    }

    Ok(())
}

fn parse_auth_result_payload(body: &str) -> Result<WorkerAuthResultResponse, String> {
    serde_json::from_str(body).map_err(|e| format!("Invalid sign-in result response: {}", e))
}

pub async fn request_worker_auth_start(
    provider: &str,
    callback_url: &str,
    verifier: &str,
) -> Result<WorkerAuthStartResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(desktop_auth_start_url(provider))
        .json(&DesktopAuthStartBody {
            callback_url,
            verifier,
        })
        .send()
        .await
        .map_err(|e| format!("Failed to start {} sign-in via API: {}", provider, e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read sign-in start response: {}", e))?;

    if !status.is_success() {
        let payload = parse_auth_result_payload(&body).unwrap_or(WorkerAuthResultResponse {
            success: false,
            pending: None,
            provider: None,
            session_token: None,
            username: None,
            primary_email: None,
            avatar_url: None,
            error: None,
        });
        return Err(payload.error.unwrap_or_else(|| {
            format!(
                "{} sign-in start API failed with status {}: {}",
                provider,
                status.as_u16(),
                body
            )
        }));
    }

    let payload: WorkerAuthStartResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Invalid sign-in start response: {}", e))?;

    if !payload.success || payload.auth_url.trim().is_empty() || payload.state.trim().is_empty() {
        return Err("Sign-in start response is missing authUrl or state".to_string());
    }

    Ok(payload)
}

pub async fn request_worker_auth_result(
    provider: &str,
    state: &str,
    verifier: &str,
) -> Result<WorkerAuthResultResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(desktop_auth_result_url(provider))
        .json(&DesktopAuthResultBody { state, verifier })
        .send()
        .await
        .map_err(|e| format!("Failed to complete sign-in via API: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read sign-in result response: {}", e))?;

    let payload = parse_auth_result_payload(&body)?;
    if status.is_success() || status.as_u16() == 202 || payload.pending.unwrap_or(false) {
        return Ok(payload);
    }

    Err(payload
        .error
        .unwrap_or_else(|| format!("Sign-in result API failed with status {}", status.as_u16())))
}

pub async fn wait_for_worker_auth_completion(
    provider: &str,
    state: &str,
    verifier: &str,
    expires_in_seconds: Option<u64>,
) -> Result<WorkerAuthResultResponse, String> {
    let timeout_seconds = expires_in_seconds
        .unwrap_or(DEFAULT_AUTH_TIMEOUT_SECONDS)
        .clamp(DEFAULT_AUTH_TIMEOUT_SECONDS, MAX_AUTH_TIMEOUT_SECONDS);
    let deadline = Instant::now() + Duration::from_secs(timeout_seconds);

    loop {
        let payload = request_worker_auth_result(provider, state, verifier).await?;
        if payload.success || !payload.pending.unwrap_or(false) {
            return Ok(payload);
        }

        if Instant::now() >= deadline {
            return Err("Authorization timed out".to_string());
        }

        sleep(Duration::from_millis(
            DEFAULT_AUTH_RESULT_RETRY_MS.min(MAX_AUTH_RESULT_RETRY_MS),
        ))
        .await;
    }
}

pub async fn request_email_auth_code(email: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(email_request_code_url())
        .json(&EmailCodeRequestBody { email })
        .send()
        .await
        .map_err(|e| format!("Failed to request email sign-in code: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read email code response: {}", e))?;

    if status.is_success() {
        return Ok(());
    }

    let payload = parse_auth_result_payload(&body).unwrap_or(WorkerAuthResultResponse {
        success: false,
        pending: None,
        provider: None,
        session_token: None,
        username: None,
        primary_email: None,
        avatar_url: None,
        error: None,
    });
    Err(payload
        .error
        .unwrap_or_else(|| format!("Email sign-in request failed with status {}: {}", status.as_u16(), body)))
}

pub async fn verify_email_auth_code(
    email: &str,
    code: &str,
) -> Result<WorkerAuthResultResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(email_verify_code_url())
        .json(&EmailCodeVerifyBody {
            email,
            code,
            target: "desktop",
        })
        .send()
        .await
        .map_err(|e| format!("Failed to verify email sign-in code: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read email verify response: {}", e))?;

    let payload: WorkerAuthResultResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Invalid email verify response: {}", e))?;

    if !status.is_success() && !payload.success {
        return Err(payload
            .error
            .unwrap_or_else(|| format!("Email sign-in verify failed with status {}", status.as_u16())));
    }

    Ok(payload)
}
