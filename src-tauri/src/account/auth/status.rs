use crate::account::{
    credentials::{
        delete_account_credentials, load_account_credentials, save_account_credentials,
        AccountCredentials,
    },
    types::AccountSessionStatus,
};
use reqwest::header::ACCEPT;
use serde::Deserialize;

use super::worker_api::{persist_rotated_session_token_from_headers, read_api_base_url};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerSessionStatusResponse {
    success: bool,
    connected: bool,
    provider: Option<String>,
    username: Option<String>,
    primary_email: Option<String>,
    avatar_url: Option<String>,
    membership_tier: Option<String>,
    membership_name: Option<String>,
}

fn session_status_url() -> String {
    format!("{}/auth/session", read_api_base_url())
}

fn disconnected_status() -> AccountSessionStatus {
    AccountSessionStatus {
        connected: false,
        provider: None,
        username: None,
        primary_email: None,
        avatar_url: None,
        membership_tier: None,
        membership_name: None,
    }
}

pub async fn get_account_session_status_impl(
    app: &tauri::AppHandle,
) -> Result<AccountSessionStatus, String> {
    match load_account_credentials(app) {
        Some(creds) => {
            let client = reqwest::Client::new();
            let response = match client
                .get(session_status_url())
                .bearer_auth(&creds.app_session_token)
                .header(ACCEPT, "application/json")
                .send()
                .await
            {
                Ok(response) => response,
                Err(_) => {
                    return Ok(AccountSessionStatus {
                        connected: true,
                        provider: Some(creds.provider),
                        username: Some(creds.username),
                        primary_email: creds.primary_email,
                        avatar_url: creds.avatar_url,
                        membership_tier: None,
                        membership_name: None,
                    })
                }
            };

            if response.status() == reqwest::StatusCode::UNAUTHORIZED
                || response.status() == reqwest::StatusCode::FORBIDDEN
            {
                let _ = delete_account_credentials(app);
                return Ok(disconnected_status());
            }

            if !response.status().is_success() {
                return Ok(AccountSessionStatus {
                    connected: true,
                    provider: Some(creds.provider),
                    username: Some(creds.username),
                    primary_email: creds.primary_email,
                    avatar_url: creds.avatar_url,
                    membership_tier: None,
                    membership_name: None,
                });
            }

            persist_rotated_session_token_from_headers(app, response.headers())?;

            let payload: WorkerSessionStatusResponse = response
                .json()
                .await
                .map_err(|error| format!("Invalid account session response: {}", error))?;

            if !payload.success || !payload.connected {
                let _ = delete_account_credentials(app);
                return Ok(disconnected_status());
            }

            let provider = payload
                .provider
                .filter(|value| matches!(value.as_str(), "github" | "google" | "email"))
                .unwrap_or(creds.provider);
            let username = payload
                .username
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or(creds.username);
            let primary_email = payload.primary_email.or(creds.primary_email);
            let avatar_url = payload.avatar_url.or(creds.avatar_url);
            let membership_tier = payload.membership_tier;
            let membership_name = payload.membership_name;

            let refreshed_credentials = AccountCredentials {
                app_session_token: load_account_credentials(app)
                    .map(|value| value.app_session_token)
                    .unwrap_or(creds.app_session_token),
                provider: provider.clone(),
                username: username.clone(),
                primary_email: primary_email.clone(),
                avatar_url: avatar_url.clone(),
            };
            let _ = save_account_credentials(app, &refreshed_credentials);

            Ok(AccountSessionStatus {
                connected: true,
                provider: Some(provider),
                username: Some(username),
                primary_email,
                avatar_url,
                membership_tier,
                membership_name,
            })
        }
        None => Ok(disconnected_status()),
    }
}
