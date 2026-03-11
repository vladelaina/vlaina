use std::collections::BTreeMap;
use std::path::PathBuf;

use chrono::Local;

use crate::github::config_sync_local::{apply_remote_files_to_local, load_local_config_files};
use crate::github::config_sync_support::{build_config_sync_operations, filter_config_remote_shas};
use crate::github::credentials::{
    get_data_dir, get_stored_github_token, get_stored_github_username, CONFIG_REPO_NAME,
    NEKOTICK_FOLDER,
};
use crate::github::repos::RepoClient;
use crate::github::types::{RepoChangesetCommitResult, Repository};

fn sync_commit_message() -> String {
    format!("sync: {}", Local::now().format("%Y-%m-%d %H:%M:%S"))
}

fn get_nekotick_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_data_dir(app)?.join(NEKOTICK_FOLDER))
}

async fn ensure_config_repo(token: &str, username: &str) -> Result<Repository, String> {
    let client = RepoClient::new(token.to_string());

    if let Some(repo) = client
        .find_repo_by_name(username, CONFIG_REPO_NAME)
        .await
        .map_err(|error| error.to_string())?
    {
        return Ok(repo);
    }

    match client
        .create_repo(CONFIG_REPO_NAME, true, Some("NekoTick config sync"))
        .await
    {
        Ok(repo) => Ok(repo),
        Err(error) => {
            let error_message = error.to_string();
            if !error_message.contains("422") && !error_message.contains("already exists") {
                return Err(error_message);
            }

            client
                .find_repo_by_name(username, CONFIG_REPO_NAME)
                .await
                .map_err(|lookup_error| lookup_error.to_string())?
                .ok_or(error_message)
        }
    }
}

pub async fn sync_config_repo_ready(token: &str, username: &str) -> Result<(), String> {
    ensure_config_repo(token, username).await.map(|_| ())
}

async fn load_remote_config_shas(
    client: &RepoClient,
    repository: &Repository,
) -> Result<BTreeMap<String, String>, String> {
    let entries = client
        .get_repo_recursive_tree(
            &repository.owner.login,
            &repository.name,
            &repository.default_branch,
        )
        .await
        .map_err(|error| error.to_string())?;

    Ok(filter_config_remote_shas(entries))
}

async fn load_remote_config_files(
    client: &RepoClient,
    repository: &Repository,
) -> Result<(BTreeMap<String, String>, BTreeMap<String, String>), String> {
    let remote_shas = load_remote_config_shas(client, repository).await?;
    let mut remote_files = BTreeMap::new();

    for path in remote_shas.keys() {
        let file = client
            .get_file_content(&repository.owner.login, &repository.name, path)
            .await
            .map_err(|error| error.to_string())?;
        remote_files.insert(path.clone(), file.content);
    }

    Ok((remote_shas, remote_files))
}

fn ensure_committed(result: RepoChangesetCommitResult) -> Result<(), String> {
    if result.status == "conflict" {
        return Err("Sync conflict".to_string());
    }
    Ok(())
}

pub async fn sync_config_to_repo(app: &tauri::AppHandle) -> Result<(), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;
    let repository = ensure_config_repo(&token, &username).await?;
    let local_files = load_local_config_files(&get_nekotick_dir(app)?)?;
    let client = RepoClient::new(token);
    let remote_shas = load_remote_config_shas(&client, &repository).await?;
    let operations = build_config_sync_operations(&local_files, &remote_shas);

    ensure_committed(
        client
            .commit_changeset(
                &repository.owner.login,
                &repository.name,
                &repository.default_branch,
                &sync_commit_message(),
                &operations,
            )
            .await
            .map_err(|error| error.to_string())?,
    )
}

pub async fn restore_config_from_repo(app: &tauri::AppHandle) -> Result<(), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;
    let repository = ensure_config_repo(&token, &username).await?;
    let client = RepoClient::new(token);
    let (_, remote_files) = load_remote_config_files(&client, &repository).await?;

    if remote_files.is_empty() {
        return Ok(());
    }

    apply_remote_files_to_local(&get_nekotick_dir(app)?, &remote_files, false)?;
    Ok(())
}

pub async fn sync_config_bidirectional(app: &tauri::AppHandle) -> Result<(bool, bool), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;
    let repository = ensure_config_repo(&token, &username).await?;
    let client = RepoClient::new(token);
    let nekotick_dir = get_nekotick_dir(app)?;
    let (remote_shas, remote_files) = load_remote_config_files(&client, &repository).await?;

    let pulled = if remote_files.is_empty() {
        false
    } else {
        apply_remote_files_to_local(&nekotick_dir, &remote_files, true)?
    };

    let local_files = load_local_config_files(&nekotick_dir)?;
    let operations = build_config_sync_operations(&local_files, &remote_shas);
    let pushed = !operations.is_empty();

    ensure_committed(
        client
            .commit_changeset(
                &repository.owner.login,
                &repository.name,
                &repository.default_branch,
                &sync_commit_message(),
                &operations,
            )
            .await
            .map_err(|error| error.to_string())?,
    )?;

    Ok((pulled, pushed))
}

pub async fn check_config_remote(app: &tauri::AppHandle) -> Result<(bool, Option<String>), String> {
    let token = get_stored_github_token(app).ok_or("Not authenticated")?;
    let username = get_stored_github_username(app).ok_or("Username not available")?;
    let client = RepoClient::new(token);

    match client.find_repo_by_name(&username, CONFIG_REPO_NAME).await {
        Ok(Some(repo)) => Ok((true, Some(repo.updated_at))),
        Ok(None) => Ok((false, None)),
        Err(error) => Err(error.to_string()),
    }
}
