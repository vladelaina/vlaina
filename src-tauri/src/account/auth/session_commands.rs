use crate::account::{
    credentials::{
        delete_account_credentials, get_stored_app_session_token, save_account_credentials,
        AccountCredentials,
    },
    types::{AccountAuthResult, AccountSessionStatus},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;

use super::{
    browser::open_auth_url,
    loopback::bind_loopback_server,
    status::get_account_session_status_impl,
    worker_api::{
        read_api_base_url, request_email_auth_code as request_email_auth_code_via_worker,
        request_worker_auth_start, verify_email_auth_code as verify_email_auth_code_via_worker,
        wait_for_worker_auth_completion,
    },
};

fn error_result(error: String) -> AccountAuthResult {
    AccountAuthResult {
        success: false,
        provider: None,
        username: None,
        primary_email: None,
        avatar_url: None,
        error: Some(error),
    }
}

fn generate_desktop_verifier() -> String {
    let mut bytes = [0u8; 48];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn normalize_oauth_provider(provider: &str) -> Option<&'static str> {
    match provider.trim() {
        "google" => Some("google"),
        "github" => Some("github"),
        _ => None,
    }
}

fn persist_account_result(
    app: &tauri::AppHandle,
    provider: &str,
    session_token: String,
    username: String,
    primary_email: Option<String>,
    avatar_url: Option<String>,
) -> Result<AccountAuthResult, String> {
    let creds = AccountCredentials {
        app_session_token: session_token,
        provider: provider.to_string(),
        username: username.clone(),
        primary_email: primary_email.clone(),
        avatar_url: avatar_url.clone(),
    };

    save_account_credentials(app, &creds)?;

    Ok(AccountAuthResult {
        success: true,
        provider: Some(provider.to_string()),
        username: Some(username),
        primary_email,
        avatar_url,
        error: None,
    })
}

fn session_revoke_url() -> String {
    format!("{}/auth/session/revoke", read_api_base_url())
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
pub async fn account_auth(
    app: tauri::AppHandle,
    provider: String,
) -> Result<AccountAuthResult, String> {
    let provider = match normalize_oauth_provider(&provider) {
        Some(value) => value,
        None => {
            return Ok(error_result(
                "Unsupported desktop sign-in provider".to_string(),
            ))
        }
    };

    let verifier = generate_desktop_verifier();
    let loopback = match bind_loopback_server().await {
        Ok(server) => server,
        Err(error) => return Ok(error_result(error)),
    };

    let auth_start =
        match request_worker_auth_start(provider, &loopback.callback_url, &verifier).await {
            Ok(value) => value,
            Err(error) => return Ok(error_result(error)),
        };

    if let Err(error) = open_auth_url(&auth_start.auth_url) {
        return Ok(error_result(error));
    }

    let callback = match loopback
        .wait_for_callback(
            &auth_start.state,
            auth_start.expires_in_seconds.unwrap_or(300),
        )
        .await
    {
        Ok(value) => value,
        Err(error) => return Ok(error_result(error)),
    };

    let result = match wait_for_worker_auth_completion(
        provider,
        &callback.state,
        &verifier,
        auth_start.expires_in_seconds,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => return Ok(error_result(error)),
    };

    if !result.success {
        let message = callback
            .error
            .or(result.error)
            .unwrap_or_else(|| "Authorization failed".to_string());
        return Ok(error_result(message));
    }

    let app_session_token = match result.session_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Ok(error_result(
                "Account sign-in result missing sessionToken".to_string(),
            ))
        }
    };

    let username = match result.username {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => {
            return Ok(error_result(
                "Account sign-in result missing username".to_string(),
            ))
        }
    };

    match persist_account_result(
        &app,
        provider,
        app_session_token,
        username,
        result.primary_email,
        result.avatar_url,
    ) {
        Ok(value) => Ok(value),
        Err(error) => Ok(error_result(error)),
    }
}

#[tauri::command]
pub async fn request_email_auth_code(email: String) -> Result<bool, String> {
    request_email_auth_code_via_worker(&email).await?;
    Ok(true)
}

#[tauri::command]
pub async fn verify_email_auth_code(
    app: tauri::AppHandle,
    email: String,
    code: String,
) -> Result<AccountAuthResult, String> {
    let result = match verify_email_auth_code_via_worker(&email, &code).await {
        Ok(payload) => payload,
        Err(error) => return Ok(error_result(error)),
    };

    let app_session_token = match result.session_token {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Ok(error_result(
                "Account sign-in result missing sessionToken".to_string(),
            ))
        }
    };

    let username = match result.username {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => {
            return Ok(error_result(
                "Account sign-in result missing username".to_string(),
            ))
        }
    };
    match persist_account_result(
        &app,
        "email",
        app_session_token,
        username,
        result.primary_email,
        result.avatar_url,
    ) {
        Ok(value) => Ok(value),
        Err(error) => Ok(error_result(error)),
    }
}

#[tauri::command]
pub async fn account_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(session_token) = get_stored_app_session_token(&app) {
        if let Err(error) = revoke_worker_session(&session_token).await {
            eprintln!("{}", error);
        }
    }
    delete_account_credentials(&app)
}

#[tauri::command]
pub async fn get_account_session_status(
    app: tauri::AppHandle,
) -> Result<AccountSessionStatus, String> {
    get_account_session_status_impl(&app).await
}
