//! Tauri commands for GitHub Repository operations
//!
//! These commands are exposed to the frontend via Tauri's IPC.

use crate::github::credentials::get_stored_github_token;
use crate::github::repos::{
    ensure_managed_content_repo_access, ensure_managed_content_repo_name, get_display_name,
    normalize_managed_content_repo_name, RepoClient,
};
use crate::github::types::{
    FileContent, RepoChangeOperation, RepoChangesetCommitResult, Repository, TreeEntry,
};
use serde::{Deserialize, Serialize};

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

fn get_access_token(app: &tauri::AppHandle) -> Result<String, String> {
    get_stored_github_token(app).ok_or_else(|| "Not connected to GitHub".to_string())
}

async fn ensure_accessible_content_repo(
    client: &RepoClient,
    owner: &str,
    repo: &str,
) -> Result<(), String> {
    ensure_managed_content_repo_name(repo)?;
    let repos = client
        .list_nekotick_repos()
        .await
        .map_err(|error| error.to_string())?;
    ensure_managed_content_repo_access(&repos, owner, repo)
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

#[tauri::command]
pub async fn get_repo_tree_recursive(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    branch: String,
) -> Result<Vec<TreeEntry>, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    ensure_accessible_content_repo(&client, &owner, &repo).await?;

    client
        .get_repo_recursive_tree(&owner, &repo, &branch)
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
    ensure_accessible_content_repo(&client, &owner, &repo).await?;

    client
        .get_file_content(&owner, &repo, &path)
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
    let normalized_name = normalize_managed_content_repo_name(&name);
    ensure_managed_content_repo_name(&normalized_name)?;
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);

    let repo = client
        .create_repo(&normalized_name, private, description.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(RepositoryInfo::from(repo))
}

#[tauri::command]
pub async fn commit_repo_changeset(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    branch: String,
    message: String,
    operations: Vec<RepoChangeOperation>,
) -> Result<RepoChangesetCommitResult, String> {
    let token = get_access_token(&app)?;
    let client = RepoClient::new(token);
    ensure_accessible_content_repo(&client, &owner, &repo).await?;

    client
        .commit_changeset(&owner, &repo, &branch, &message, &operations)
        .await
        .map_err(|e| e.to_string())
}
