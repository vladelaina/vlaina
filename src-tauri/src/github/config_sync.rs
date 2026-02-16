use crate::github::repos::RepoClient;
use crate::github::git_ops;
use crate::github::commands::{get_stored_github_token, get_stored_github_username};
use chrono::Local;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_REPO_NAME: &str = "nekotick-config";
const NEKOTICK_FOLDER: &str = ".nekotick";
const DATA_FILE_NAME: &str = "data.json";
const CHAT_SESSIONS_FILE: &str = "chat/sessions.json";
const CHAT_CHANNELS_DIR: &str = "chat/channels";

fn sync_commit_message() -> String {
    format!("sync: {}", Local::now().format("%Y-%m-%d %H:%M:%S"))
}

fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn get_nekotick_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_data_dir(app)?.join(NEKOTICK_FOLDER))
}

fn config_files() -> Vec<&'static str> {
    vec![DATA_FILE_NAME, CHAT_SESSIONS_FILE]
}

pub async fn ensure_config_repo(token: &str, username: &str) -> Result<bool, String> {
    let client = RepoClient::new(token.to_string());

    let exists = client
        .find_repo_by_name(username, CONFIG_REPO_NAME)
        .await
        .map_err(|e| e.to_string())?
        .is_some();

    if !exists {
        match client.create_repo(CONFIG_REPO_NAME, true, Some("NekoTick config sync")).await {
            Ok(_) => {}
            Err(e) => {
                let err_str = e.to_string();
                if !err_str.contains("422") && !err_str.contains("already exists") {
                    return Err(err_str);
                }
            }
        }
    }

    let is_cloned = tokio::task::spawn_blocking({
        let owner = username.to_string();
        move || git_ops::is_repo_cloned(&owner, CONFIG_REPO_NAME)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if !is_cloned {
        let token = token.to_string();
        let owner = username.to_string();
        tokio::task::spawn_blocking(move || {
            git_ops::clone_repo(&owner, CONFIG_REPO_NAME, &token)
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    }

    Ok(true)
}

fn copy_local_to_clone(nekotick_dir: &PathBuf, clone_dir: &PathBuf) -> Result<(), String> {
    for file in config_files() {
        let src = nekotick_dir.join(file);
        let dst = clone_dir.join(file);
        if src.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| format!("Failed to copy {}: {}", file, e))?;
        }
    }

    let local_channels = nekotick_dir.join(CHAT_CHANNELS_DIR);
    let clone_channels = clone_dir.join(CHAT_CHANNELS_DIR);

    if clone_channels.exists() {
        for entry in fs::read_dir(&clone_channels).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let local_file = local_channels.join(entry.file_name());
                if !local_file.exists() {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }

    if local_channels.exists() {
        fs::create_dir_all(&clone_channels).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(&local_channels).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let dst = clone_channels.join(entry.file_name());
                fs::copy(&path, &dst).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

fn copy_clone_to_local(clone_dir: &PathBuf, nekotick_dir: &PathBuf) -> Result<(), String> {
    for file in config_files() {
        let src = clone_dir.join(file);
        let dst = nekotick_dir.join(file);
        if src.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| format!("Failed to restore {}: {}", file, e))?;
        }
    }

    let clone_channels = clone_dir.join(CHAT_CHANNELS_DIR);
    let local_channels = nekotick_dir.join(CHAT_CHANNELS_DIR);
    if clone_channels.exists() {
        fs::create_dir_all(&local_channels).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(&clone_channels).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let dst = local_channels.join(entry.file_name());
                fs::copy(&path, &dst).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

pub async fn sync_config_to_repo(app: &tauri::AppHandle) -> Result<(), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;

    ensure_config_repo(&token, &username).await?;

    let nekotick_dir = get_nekotick_dir(app)?;
    let clone_dir = tokio::task::spawn_blocking({
        let owner = username.clone();
        move || git_ops::get_repo_local_path(&owner, CONFIG_REPO_NAME)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let token_pull = token.clone();
    let owner_pull = username.clone();
    tokio::task::spawn_blocking(move || {
        git_ops::pull_repo(&owner_pull, CONFIG_REPO_NAME, &token_pull)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    copy_local_to_clone(&nekotick_dir, &clone_dir)?;

    let owner = username.clone();
    let email = format!("{}@users.noreply.github.com", &username);
    let token_clone = token.clone();
    let message = sync_commit_message();
    tokio::task::spawn_blocking(move || {
        let commit_id = git_ops::commit_all(&owner, CONFIG_REPO_NAME, &message, &owner, &email)?;
        if !commit_id.is_empty() {
            git_ops::push_repo(&owner, CONFIG_REPO_NAME, &token_clone)?;
        }
        Ok::<(), git_ops::GitError>(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn restore_config_from_repo(app: &tauri::AppHandle) -> Result<(), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;

    ensure_config_repo(&token, &username).await?;

    let token_clone = token.clone();
    let owner = username.clone();
    tokio::task::spawn_blocking(move || {
        git_ops::pull_repo(&owner, CONFIG_REPO_NAME, &token_clone)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let nekotick_dir = get_nekotick_dir(app)?;
    let clone_dir = tokio::task::spawn_blocking({
        let owner = username.clone();
        move || git_ops::get_repo_local_path(&owner, CONFIG_REPO_NAME)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let data_path = nekotick_dir.join(DATA_FILE_NAME);
    let backup_path = nekotick_dir.join(format!("{}.backup", DATA_FILE_NAME));
    if data_path.exists() {
        fs::copy(&data_path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    if let Err(e) = copy_clone_to_local(&clone_dir, &nekotick_dir) {
        if backup_path.exists() {
            fs::copy(&backup_path, &data_path)
                .map_err(|be| format!("Restore failed: {}. Backup restore also failed: {}", e, be))?;
        }
        return Err(e);
    }

    Ok(())
}

fn copy_missing_to_local(clone_dir: &PathBuf, nekotick_dir: &PathBuf) -> Result<bool, String> {
    let mut copied = false;

    for file in config_files() {
        let src = clone_dir.join(file);
        let dst = nekotick_dir.join(file);
        if src.exists() && !dst.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| format!("Failed to copy {}: {}", file, e))?;
            copied = true;
        }
    }

    let clone_channels = clone_dir.join(CHAT_CHANNELS_DIR);
    let local_channels = nekotick_dir.join(CHAT_CHANNELS_DIR);
    if clone_channels.exists() {
        fs::create_dir_all(&local_channels).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(&clone_channels).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let dst = local_channels.join(entry.file_name());
                if !dst.exists() {
                    fs::copy(&path, &dst).map_err(|e| e.to_string())?;
                    copied = true;
                }
            }
        }
    }

    Ok(copied)
}

pub async fn sync_config_bidirectional(app: &tauri::AppHandle) -> Result<(bool, bool), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;

    ensure_config_repo(&token, &username).await?;

    let nekotick_dir = get_nekotick_dir(app)?;
    let clone_dir = tokio::task::spawn_blocking({
        let owner = username.clone();
        move || git_ops::get_repo_local_path(&owner, CONFIG_REPO_NAME)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // 1. Pull remote
    let token_pull = token.clone();
    let owner_pull = username.clone();
    tokio::task::spawn_blocking(move || {
        git_ops::pull_repo(&owner_pull, CONFIG_REPO_NAME, &token_pull)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // 2. Copy remote-only files to local (only files that don't exist locally)
    let pulled = copy_missing_to_local(&clone_dir, &nekotick_dir)?;

    // 3. Local overwrites clone dir (local always wins)
    copy_local_to_clone(&nekotick_dir, &clone_dir)?;

    // 4. Commit + push
    let owner = username.clone();
    let email = format!("{}@users.noreply.github.com", &username);
    let token_push = token.clone();
    let message = sync_commit_message();
    tokio::task::spawn_blocking(move || {
        let commit_id = git_ops::commit_all(&owner, CONFIG_REPO_NAME, &message, &owner, &email)?;
        if !commit_id.is_empty() {
            git_ops::push_repo(&owner, CONFIG_REPO_NAME, &token_push)?;
        }
        Ok::<(), git_ops::GitError>(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    Ok((pulled, true))
}

pub async fn check_config_remote(app: &tauri::AppHandle) -> Result<(bool, Option<String>), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;

    let client = RepoClient::new(token);
    match client.find_repo_by_name(&username, CONFIG_REPO_NAME).await {
        Ok(Some(repo)) => Ok((true, Some(repo.updated_at))),
        Ok(None) => Ok((false, None)),
        Err(e) => Err(e.to_string()),
    }
}
