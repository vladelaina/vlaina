use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct GitHubAccountMeta {
    pub username: String,
    #[serde(default)]
    pub github_id: Option<u64>,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

pub(crate) const GITHUB_META_FILE: &str = "github_account_meta.json";
pub(crate) const LEGACY_GITHUB_CREDS_FILE: &str = "github_credentials.json";

pub(crate) fn github_meta_path(store_dir: &Path) -> PathBuf {
    store_dir.join(GITHUB_META_FILE)
}

pub(crate) fn legacy_github_creds_path(store_dir: &Path) -> PathBuf {
    store_dir.join(LEGACY_GITHUB_CREDS_FILE)
}

pub(crate) fn load_account_meta(store_dir: &Path) -> Option<GitHubAccountMeta> {
    let content = fs::read_to_string(github_meta_path(store_dir)).ok()?;
    serde_json::from_str(&content).ok()
}

pub(crate) fn save_account_meta(store_dir: &Path, meta: &GitHubAccountMeta) -> Result<(), String> {
    fs::create_dir_all(store_dir).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(github_meta_path(store_dir), content).map_err(|e| e.to_string())
}

pub(crate) fn delete_account_meta(store_dir: &Path) -> Result<(), String> {
    let path = github_meta_path(store_dir);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        delete_account_meta, github_meta_path, legacy_github_creds_path, load_account_meta,
        save_account_meta, GitHubAccountMeta, GITHUB_META_FILE, LEGACY_GITHUB_CREDS_FILE,
    };
    use tempfile::tempdir;

    #[test]
    fn saves_and_loads_account_meta() {
        let temp = tempdir().unwrap();
        let meta = GitHubAccountMeta {
            username: "octocat".to_string(),
            github_id: Some(1),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
        };

        save_account_meta(temp.path(), &meta).unwrap();

        assert_eq!(load_account_meta(temp.path()), Some(meta));
    }

    #[test]
    fn deletes_account_meta_file() {
        let temp = tempdir().unwrap();
        let meta = GitHubAccountMeta {
            username: "octocat".to_string(),
            github_id: None,
            avatar_url: None,
        };

        save_account_meta(temp.path(), &meta).unwrap();
        delete_account_meta(temp.path()).unwrap();

        assert!(!github_meta_path(temp.path()).exists());
        assert_eq!(load_account_meta(temp.path()), None);
    }

    #[test]
    fn exposes_expected_file_names() {
        let temp = tempdir().unwrap();

        assert_eq!(
            github_meta_path(temp.path()).file_name().unwrap(),
            GITHUB_META_FILE
        );
        assert_eq!(
            legacy_github_creds_path(temp.path()).file_name().unwrap(),
            LEGACY_GITHUB_CREDS_FILE
        );
    }
}
