use crate::github::{
    config_sync,
    credentials::{load_github_credentials, load_github_sync_meta},
    types::GitHubSyncStatus,
};

pub async fn get_github_sync_status_impl(
    app: &tauri::AppHandle,
) -> Result<GitHubSyncStatus, String> {
    let sync_meta = load_github_sync_meta(app);

    match load_github_credentials(app) {
        Some(creds) => {
            let config_ready = config_sync::check_config_remote(app)
                .await
                .map(|(exists, _)| exists)
                .unwrap_or(false);
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
