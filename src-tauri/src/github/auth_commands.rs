use crate::github::{
    repos::RepoClient,
    oauth::GitHubOAuthClient,
    config_sync,
    credentials::{
        load_github_credentials, save_github_credentials, delete_github_credentials,
        load_github_sync_meta, load_oauth_config, GitHubCredentials,
    },
    types::{
        GitHubSyncStatus, GitHubAuthResult, ProStatusResult,
    },
};

#[tauri::command]
pub async fn github_auth(app: tauri::AppHandle) -> Result<GitHubAuthResult, String> {
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;
    use socket2::{Socket, Domain, Type, Protocol};

    let oauth_config = load_oauth_config()?;

    const CALLBACK_PORT: u16 = 8914;

    let state = GitHubOAuthClient::generate_state();

    let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
        .map_err(|e| format!("Failed to create socket: {}", e))?;

    socket.set_reuse_address(true)
        .map_err(|e| format!("Failed to set SO_REUSEADDR: {}", e))?;

    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", CALLBACK_PORT).parse().unwrap();
    socket.bind(&addr.into())
        .map_err(|e| format!("Failed to bind to port {}: {}. Port may be in use.", CALLBACK_PORT, e))?;

    socket.listen(1)
        .map_err(|e| format!("Failed to listen: {}", e))?;

    let listener: TcpListener = socket.into();

    let oauth = GitHubOAuthClient::new(oauth_config.client_id.clone(), oauth_config.client_secret.clone());
    let auth_url = oauth.build_auth_url(&state, CALLBACK_PORT);

    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let state_clone = state.clone();

    thread::spawn(move || {
        if let Err(e) = listener.set_nonblocking(false) {
            let _ = tx.send(Err(format!("Failed to set blocking: {}", e)));
            return;
        }

        match GitHubOAuthClient::wait_for_callback(listener, &state_clone) {
            Ok(code) => {
                let _ = tx.send(Ok(code));
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
        }
    });

    if let Err(e) = open::that(&auth_url) {
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(format!("Failed to open browser: {}", e)),
        });
    }

    let code = match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(Ok(code)) => code,
        Ok(Err(e)) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(e),
            });
        }
        Err(_) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some("Authorization timed out".to_string()),
            });
        }
    };

    let tokens = match oauth.exchange_code(&code, CALLBACK_PORT).await {
        Ok(t) => t,
        Err(e) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(e.to_string()),
            });
        }
    };

    let client = RepoClient::new(tokens.access_token.clone());
    let user_info = match client.get_user_info().await {
        Ok(u) => u,
        Err(e) => {
            return Ok(GitHubAuthResult {
                success: false,
                username: None,
                error: Some(format!("Failed to get user info: {}", e)),
            });
        }
    };

    let creds = GitHubCredentials {
        access_token: tokens.access_token.clone(),
        username: user_info.login.clone(),
        github_id: Some(user_info.id),
        avatar_url: user_info.avatar_url.clone(),
    };

    if let Err(e) = save_github_credentials(&app, &creds) {
        return Ok(GitHubAuthResult {
            success: false,
            username: None,
            error: Some(e),
        });
    }

    let token_for_config = tokens.access_token.clone();
    let username_for_config = user_info.login.clone();
    tokio::spawn(async move {
        let _ = config_sync::ensure_config_repo(&token_for_config, &username_for_config).await;
    });

    let access_token_for_register = tokens.access_token.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let _ = client
            .post("https://api.nekotick.com/auth/register")
            .json(&serde_json::json!({
                "access_token": access_token_for_register
            }))
            .send()
            .await;
    });

    Ok(GitHubAuthResult {
        success: true,
        username: Some(user_info.login),
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
            let config_ready = config_sync::check_config_remote(&app).await.map(|(exists, _)| exists).unwrap_or(false);
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

#[tauri::command]
pub async fn check_pro_status(app: tauri::AppHandle) -> Result<ProStatusResult, String> {
    let creds = load_github_credentials(&app)
        .ok_or("Not connected to GitHub")?;

    let github_id = creds.github_id
        .ok_or("GitHub ID not available. Please reconnect to GitHub.")?;

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.nekotick.com/check_pro")
        .json(&serde_json::json!({
            "github_id": github_id
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to check PRO status: {}", e))?;

    if !response.status().is_success() {
        return Ok(ProStatusResult {
            is_pro: false,
            expires_at: None,
        });
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let is_pro = data.get("isPro").and_then(|v| v.as_bool()).unwrap_or(false);
    let expires_at = data.get("expiresAt").and_then(|v| v.as_i64());

    Ok(ProStatusResult {
        is_pro,
        expires_at,
    })
}
