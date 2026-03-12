use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct AccountMeta {
    #[serde(default)]
    pub provider: Option<String>,
    pub username: String,
    #[serde(default)]
    pub primary_email: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

pub(crate) const ACCOUNT_META_FILE: &str = "account_meta.json";

fn account_meta_path(store_dir: &Path) -> PathBuf {
    store_dir.join(ACCOUNT_META_FILE)
}

pub(crate) fn load_account_meta(store_dir: &Path) -> Option<AccountMeta> {
    let content = fs::read_to_string(account_meta_path(store_dir)).ok()?;
    serde_json::from_str(&content).ok()
}

pub(crate) fn save_account_meta(store_dir: &Path, meta: &AccountMeta) -> Result<(), String> {
    fs::create_dir_all(store_dir).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(account_meta_path(store_dir), content).map_err(|e| e.to_string())
}

pub(crate) fn delete_account_meta(store_dir: &Path) -> Result<(), String> {
    let path = account_meta_path(store_dir);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        account_meta_path, delete_account_meta, load_account_meta, save_account_meta, AccountMeta,
        ACCOUNT_META_FILE,
    };
    use tempfile::tempdir;

    #[test]
    fn saves_and_loads_account_meta() {
        let temp = tempdir().unwrap();
        let meta = AccountMeta {
            provider: Some("google".to_string()),
            username: "octocat".to_string(),
            primary_email: Some("octocat@example.com".to_string()),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
        };

        save_account_meta(temp.path(), &meta).unwrap();

        assert_eq!(load_account_meta(temp.path()), Some(meta));
    }

    #[test]
    fn deletes_account_meta_file() {
        let temp = tempdir().unwrap();
        let meta = AccountMeta {
            provider: Some("github".to_string()),
            username: "octocat".to_string(),
            primary_email: None,
            avatar_url: None,
        };

        save_account_meta(temp.path(), &meta).unwrap();
        delete_account_meta(temp.path()).unwrap();

        assert_eq!(load_account_meta(temp.path()), None);
    }

    #[test]
    fn exposes_expected_file_name() {
        let temp = tempdir().unwrap();
        assert_eq!(
            account_meta_path(temp.path()).file_name().unwrap(),
            ACCOUNT_META_FILE
        );
    }
}
