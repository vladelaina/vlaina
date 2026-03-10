use serde::Deserialize;
use std::time::Duration;
use tokio::time::{sleep, Instant};

const DEFAULT_API_BASE_URL: &str = "https://api.nekotick.com";
const DEFAULT_POLL_INTERVAL_MS: u64 = 1500;
const MIN_POLL_INTERVAL_MS: u64 = 500;
const MAX_POLL_INTERVAL_MS: u64 = 5000;
const DEFAULT_AUTH_TIMEOUT_SECONDS: u64 = 300;
const MAX_AUTH_TIMEOUT_SECONDS: u64 = 900;
const MAX_CONSECUTIVE_POLL_ERRORS: u8 = 5;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerAuthStartResponse {
    pub auth_url: String,
    pub state: String,
    pub poll_interval_ms: Option<u64>,
    pub expires_in_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerAuthResultResponse {
    pub success: bool,
    pub pending: Option<bool>,
    pub access_token: Option<String>,
    pub github_id: Option<u64>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub error: Option<String>,
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

pub async fn request_worker_auth_start() -> Result<WorkerAuthStartResponse, String> {
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

pub async fn wait_for_worker_auth_result(
    state: &str,
    poll_interval_ms: Option<u64>,
    expires_in_seconds: Option<u64>,
) -> Result<WorkerAuthResultResponse, String> {
    let poll_interval = poll_interval_ms
        .unwrap_or(DEFAULT_POLL_INTERVAL_MS)
        .clamp(MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
    let timeout_seconds = expires_in_seconds
        .unwrap_or(DEFAULT_AUTH_TIMEOUT_SECONDS)
        .clamp(DEFAULT_AUTH_TIMEOUT_SECONDS, MAX_AUTH_TIMEOUT_SECONDS);
    let deadline = Instant::now() + Duration::from_secs(timeout_seconds);
    let mut consecutive_poll_errors = 0u8;

    loop {
        let poll = match poll_worker_auth_result(state).await {
            Ok(payload) => {
                consecutive_poll_errors = 0;
                payload
            }
            Err(error) => {
                consecutive_poll_errors = consecutive_poll_errors.saturating_add(1);
                if Instant::now() >= deadline
                    || consecutive_poll_errors >= MAX_CONSECUTIVE_POLL_ERRORS
                {
                    return Err(error);
                }
                sleep(Duration::from_millis(poll_interval)).await;
                continue;
            }
        };

        if poll.success {
            return Ok(poll);
        }

        if poll.pending.unwrap_or(false) {
            if Instant::now() >= deadline {
                return Err("Authorization timed out".to_string());
            }
            sleep(Duration::from_millis(poll_interval)).await;
            continue;
        }

        return Err(poll.error.unwrap_or_else(|| "OAuth failed".to_string()));
    }
}
