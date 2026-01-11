//! Tauri commands for git operations

use super::git_ops::{self, CommitInfo, FileStatus};
use super::commands::{get_stored_github_token, get_stored_github_username};
use tauri::command;

/// Clone a repository to local storage
#[command]
pub async fn clone_github_repo(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
) -> Result<String, String> {
    let token = get_stored_github_token(&app).ok_or("Not authenticated with GitHub")?;
    
    tokio::task::spawn_blocking(move || {
        git_ops::clone_repo(&owner, &repo, &token)
            .map(|path| path.display().to_string())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Check if a repository is cloned locally
#[command]
pub async fn is_repo_cloned(owner: String, repo: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        git_ops::is_repo_cloned(&owner, &repo).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get the local path of a cloned repository
#[command]
pub async fn get_repo_local_path(owner: String, repo: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        git_ops::get_repo_local_path(&owner, &repo)
            .map(|p| p.display().to_string())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Pull latest changes from remote
#[command]
pub async fn pull_github_repo(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
) -> Result<(), String> {
    let token = get_stored_github_token(&app).ok_or("Not authenticated with GitHub")?;
    
    tokio::task::spawn_blocking(move || {
        git_ops::pull_repo(&owner, &repo, &token).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Push local changes to remote
#[command]
pub async fn push_github_repo(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
) -> Result<(), String> {
    let token = get_stored_github_token(&app).ok_or("Not authenticated with GitHub")?;
    
    tokio::task::spawn_blocking(move || {
        git_ops::push_repo(&owner, &repo, &token).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Commit all changes
#[command]
pub async fn commit_repo_changes(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    message: String,
) -> Result<String, String> {
    // Get author info from stored credentials
    let username = get_stored_github_username(&app).unwrap_or_else(|| "NekoTick User".to_string());
    let email = format!("{}@users.noreply.github.com", username);
    
    tokio::task::spawn_blocking(move || {
        git_ops::commit_all(&owner, &repo, &message, &username, &email)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get repository status (changed files)
#[command]
pub async fn get_repo_status(owner: String, repo: String) -> Result<Vec<FileStatus>, String> {
    tokio::task::spawn_blocking(move || {
        git_ops::get_status(&owner, &repo).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get commit history
#[command]
pub async fn get_repo_log(
    owner: String,
    repo: String,
    limit: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    let limit = limit.unwrap_or(50);
    
    tokio::task::spawn_blocking(move || {
        git_ops::get_log(&owner, &repo, limit).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get diff for a file
#[command]
pub async fn get_file_diff(
    owner: String,
    repo: String,
    file_path: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        git_ops::get_file_diff(&owner, &repo, &file_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Delete a local repository
#[command]
pub async fn delete_local_repo(owner: String, repo: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        git_ops::delete_local_repo(&owner, &repo).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// List all locally cloned repositories
#[command]
pub async fn list_local_repos() -> Result<Vec<(String, String)>, String> {
    tokio::task::spawn_blocking(|| {
        git_ops::list_local_repos().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
