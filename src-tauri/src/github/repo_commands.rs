//! Tauri commands for GitHub Repository operations
//!
//! These commands are exposed to the frontend via Tauri's IPC.

use crate::github::repos::{RepoClient, Repository, TreeEntry, FileContent, CommitResult, get_display_name};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const NEKOTICK_FOLDER: &str = ".nekotick";
const GITHUB_CREDS_FILE: &str = "github_credentials.json";

/// Stored GitHub credentials (same as in commands.rs)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct GitHubCredentials {
    access_token: String,
    username: String,
    gist_id: Option<String>,
}

/// Repository with display name for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    pub id: u64,
    pub name: String,
    pub display_name: String,
    pub full_name: String,
    pub owner: String,
    pub private: bool,
    pub html_url: String,
    pub default_branch: String,
    pub updated_at: String,
    pub description: Option<String>,
}

impl From<Repository> for RepositoryInfo {
    fn from(repo: Repository) -> Self {
        Self {
            id: repo.id,
            display_name: get_display_name(&repo.name),
            name: repo.name,
            full_name: repo.full_name,
            owner: repo.owner.login,
            private: repo.private,
            html_url: repo.html_url,
            default_branch: repo.default_branch,
            updated_at: repo.updated_at,
            description: repo.description,
        }
    }
}

/// Get the data directory path
fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
}

/// Get GitHub credentials file path
fn get_github_creds_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push(GITHUB_CREDS_FILE);
    Ok(path)
}

/// Load GitHub credentials
fn load_github_credentials(app: &tauri::AppHandle) -> Option<GitHubCredentials> {
    let path = get_github_creds_path(app).ok()?;
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Get access token from credentials
fn get_access_token(app: &tauri::AppHandle) -> Result<String, String> {
    load_github_credentials(app)
        .map(|c| c.access_token)
        .ok_or_else(|| "Not connected to GitHub".to_string())
}

/// List user's nekotick-* repositories
#[tauri::command]
pub async fn list_github_repos(app: tauri::AppHandle) -> Result<Vec<RepositoryInfo>, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    let repos = client
        .list_nekotick_repos()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(repos.into_iter().map(RepositoryInfo::from).collect())
}

/// Get repository directory contents (tree)
#[tauri::command]
pub async fn get_repo_tree(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    path: String,
) -> Result<Vec<TreeEntry>, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    client
        .get_repo_contents(&owner, &repo, &path)
        .await
        .map_err(|e| e.to_string())
}

/// Get file content from repository
#[tauri::command]
pub async fn get_repo_file_content(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    path: String,
) -> Result<FileContent, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    client
        .get_file_content(&owner, &repo, &path)
        .await
        .map_err(|e| e.to_string())
}

/// Update or create a file in repository
#[tauri::command]
pub async fn update_repo_file(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    path: String,
    content: String,
    sha: Option<String>,
    message: String,
) -> Result<CommitResult, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    client
        .update_file(&owner, &repo, &path, &content, sha.as_deref(), &message)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new repository with nekotick- prefix
#[tauri::command]
pub async fn create_github_repo(
    app: tauri::AppHandle,
    name: String,
    private: bool,
    description: Option<String>,
) -> Result<RepositoryInfo, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    let repo = client
        .create_repo(&name, private, description.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(RepositoryInfo::from(repo))
}

/// Delete a file from repository
#[tauri::command]
pub async fn delete_repo_file(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    path: String,
    sha: String,
    message: String,
) -> Result<CommitResult, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    
    client
        .delete_file(&owner, &repo, &path, &sha, &message)
        .await
        .map_err(|e| e.to_string())
}
