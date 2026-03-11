use crate::github::{
    credentials_meta_store::{
        delete_account_meta, legacy_github_creds_path, load_account_meta, save_account_meta,
        GitHubAccountMeta,
    },
    credentials_secret_store::{
        delete_secret_bundle, load_secret_bundle, save_secret_bundle, GitHubSecretBundle,
    },
    types::GitHubSyncMeta,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub const NEKOTICK_FOLDER: &str = ".nekotick";
pub const STORE_FOLDER: &str = "store";
pub const CONFIG_REPO_NAME: &str = "nekotick-config";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct GitHubCredentials {
    pub access_token: String,
    #[serde(default)]
    pub app_session_token: Option<String>,
    pub username: String,
    #[serde(default)]
    pub github_id: Option<u64>,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

pub fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn store_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(NEKOTICK_FOLDER);
    path.push(STORE_FOLDER);
    Ok(path)
}

fn github_sync_meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(store_dir(app)?.join("github_sync_meta.json"))
}

fn write_sensitive_json(path: &Path, content: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;

        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(unix))]
    {
        fs::write(path, content).map_err(|e| e.to_string())
    }
}

fn cleanup_legacy_credentials_file(store_dir: &Path) -> Result<(), String> {
    let legacy_path = legacy_github_creds_path(store_dir);
    if legacy_path.exists() {
        fs::remove_file(legacy_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn to_account_meta(creds: &GitHubCredentials) -> GitHubAccountMeta {
    GitHubAccountMeta {
        username: creds.username.clone(),
        github_id: creds.github_id,
        avatar_url: creds.avatar_url.clone(),
    }
}

fn to_secret_bundle(creds: &GitHubCredentials) -> GitHubSecretBundle {
    GitHubSecretBundle {
        access_token: creds.access_token.clone(),
        app_session_token: creds.app_session_token.clone(),
    }
}

fn join_credentials(meta: GitHubAccountMeta, secrets: GitHubSecretBundle) -> GitHubCredentials {
    GitHubCredentials {
        access_token: secrets.access_token,
        app_session_token: secrets.app_session_token,
        username: meta.username,
        github_id: meta.github_id,
        avatar_url: meta.avatar_url,
    }
}

fn migrate_legacy_credentials(store_dir: &Path) -> Option<GitHubCredentials> {
    let legacy_path = legacy_github_creds_path(store_dir);
    let content = fs::read_to_string(&legacy_path).ok()?;
    let creds: GitHubCredentials = serde_json::from_str(&content).ok()?;

    save_account_meta(store_dir, &to_account_meta(&creds)).ok()?;
    save_secret_bundle(&to_secret_bundle(&creds)).ok()?;
    cleanup_legacy_credentials_file(store_dir).ok()?;

    Some(creds)
}

pub(crate) fn load_github_credentials(app: &tauri::AppHandle) -> Option<GitHubCredentials> {
    let store_dir = store_dir(app).ok()?;
    match (
        load_account_meta(&store_dir),
        load_secret_bundle().ok().flatten(),
    ) {
        (Some(meta), Some(secrets)) => Some(join_credentials(meta, secrets)),
        _ => migrate_legacy_credentials(&store_dir),
    }
}

pub(crate) fn save_github_credentials(
    app: &tauri::AppHandle,
    creds: &GitHubCredentials,
) -> Result<(), String> {
    let store_dir = store_dir(app)?;
    save_secret_bundle(&to_secret_bundle(creds))?;
    if let Err(error) = save_account_meta(&store_dir, &to_account_meta(creds)) {
        let _ = delete_secret_bundle();
        return Err(error);
    }
    cleanup_legacy_credentials_file(&store_dir)
}

pub fn delete_github_credentials(app: &tauri::AppHandle) -> Result<(), String> {
    let store_dir = store_dir(app)?;
    delete_secret_bundle()?;
    delete_account_meta(&store_dir)?;
    cleanup_legacy_credentials_file(&store_dir)
}

pub fn get_stored_github_token(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.access_token)
}

pub fn get_stored_app_session_token(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).and_then(|c| c.app_session_token)
}

pub fn update_stored_app_session_token(
    app: &tauri::AppHandle,
    app_session_token: String,
) -> Result<(), String> {
    let mut creds = load_github_credentials(app)
        .ok_or_else(|| "GitHub credentials not found".to_string())?;
    creds.app_session_token = Some(app_session_token);
    save_github_credentials(app, &creds)
}

pub fn get_stored_github_username(app: &tauri::AppHandle) -> Option<String> {
    load_github_credentials(app).map(|c| c.username)
}

pub fn save_github_sync_meta(app: &tauri::AppHandle, meta: &GitHubSyncMeta) -> Result<(), String> {
    let path = github_sync_meta_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    write_sensitive_json(&path, &content)
}

pub fn load_github_sync_meta(app: &tauri::AppHandle) -> GitHubSyncMeta {
    if let Ok(path) = github_sync_meta_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(meta) = serde_json::from_str(&content) {
                return meta;
            }
        }
    }
    GitHubSyncMeta::default()
}

#[cfg(test)]
mod tests {
    use super::{
        cleanup_legacy_credentials_file, to_account_meta, to_secret_bundle, GitHubCredentials,
    };
    use crate::github::credentials_meta_store::{legacy_github_creds_path, load_account_meta};
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn cleans_up_legacy_credentials_file() {
        let temp = tempdir().unwrap();
        let legacy_path = legacy_github_creds_path(temp.path());
        fs::write(&legacy_path, "{}").unwrap();

        cleanup_legacy_credentials_file(temp.path()).unwrap();

        assert!(!legacy_path.exists());
    }

    #[test]
    fn converts_full_credentials_to_account_meta() {
        let creds = GitHubCredentials {
            access_token: "token".to_string(),
            app_session_token: Some("session".to_string()),
            username: "octocat".to_string(),
            github_id: Some(1),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
        };

        let meta = to_account_meta(&creds);
        assert_eq!(meta.username, "octocat");
        assert_eq!(meta.github_id, Some(1));
        assert_eq!(
            meta.avatar_url.as_deref(),
            Some("https://example.com/avatar.png")
        );
    }

    #[test]
    fn converts_full_credentials_to_secret_bundle() {
        let creds = GitHubCredentials {
            access_token: "token".to_string(),
            app_session_token: Some("session".to_string()),
            username: "octocat".to_string(),
            github_id: None,
            avatar_url: None,
        };

        let bundle = to_secret_bundle(&creds);
        assert_eq!(bundle.access_token, "token");
        assert_eq!(bundle.app_session_token.as_deref(), Some("session"));
    }

    #[test]
    fn legacy_payload_shape_matches_account_meta_reader() {
        let temp = tempdir().unwrap();
        let legacy_path = legacy_github_creds_path(temp.path());
        fs::write(
            &legacy_path,
            serde_json::to_string_pretty(&json!({
                "access_token": "token",
                "app_session_token": "session",
                "username": "octocat",
                "github_id": 1,
                "avatar_url": "https://example.com/avatar.png"
            }))
            .unwrap(),
        )
        .unwrap();

        let content = fs::read_to_string(&legacy_path).unwrap();
        let creds: GitHubCredentials = serde_json::from_str(&content).unwrap();
        let meta = to_account_meta(&creds);
        crate::github::credentials_meta_store::save_account_meta(temp.path(), &meta).unwrap();

        assert_eq!(load_account_meta(temp.path()), Some(meta));
    }
}
