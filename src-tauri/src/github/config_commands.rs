use crate::github::config_sync;
use crate::github::types::{
    GitHubSyncResult, GitHubBidirectionalSyncResult, GitHubRemoteDataInfo, GitHubSyncMeta,
};
use crate::github::credentials::save_github_sync_meta;

fn persist_sync_time(app: &tauri::AppHandle, now: i64) {
    let _ = save_github_sync_meta(app, &GitHubSyncMeta { last_sync_time: Some(now) });
}

#[tauri::command]
pub async fn sync_config_to_github(app: tauri::AppHandle) -> Result<GitHubSyncResult, String> {
    match config_sync::sync_config_to_repo(&app).await {
        Ok(()) => {
            let now = chrono::Utc::now().timestamp();
            persist_sync_time(&app, now);
            Ok(GitHubSyncResult {
                success: true,
                timestamp: Some(now),
                error: None,
            })
        }
        Err(e) => Ok(GitHubSyncResult {
            success: false,
            timestamp: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn restore_config_from_github(app: tauri::AppHandle) -> Result<GitHubSyncResult, String> {
    match config_sync::restore_config_from_repo(&app).await {
        Ok(()) => {
            let now = chrono::Utc::now().timestamp();
            persist_sync_time(&app, now);
            Ok(GitHubSyncResult {
                success: true,
                timestamp: Some(now),
                error: None,
            })
        }
        Err(e) => Ok(GitHubSyncResult {
            success: false,
            timestamp: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn sync_config_bidirectional(app: tauri::AppHandle) -> Result<GitHubBidirectionalSyncResult, String> {
    match config_sync::sync_config_bidirectional(&app).await {
        Ok((pulled, pushed)) => {
            let now = chrono::Utc::now().timestamp();
            persist_sync_time(&app, now);
            Ok(GitHubBidirectionalSyncResult {
                success: true,
                timestamp: Some(now),
                pulled_from_cloud: pulled,
                pushed_to_cloud: pushed,
                error: None,
            })
        }
        Err(e) => Ok(GitHubBidirectionalSyncResult {
            success: false,
            timestamp: None,
            pulled_from_cloud: false,
            pushed_to_cloud: false,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn check_config_remote_data(app: tauri::AppHandle) -> Result<GitHubRemoteDataInfo, String> {
    match config_sync::check_config_remote(&app).await {
        Ok((exists, modified_time)) => Ok(GitHubRemoteDataInfo {
            exists,
            modified_time,
        }),
        Err(e) => Err(e),
    }
}
