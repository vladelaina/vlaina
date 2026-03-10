use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use super::config_sync_support::{CHAT_CHANNELS_DIR, CHAT_SESSIONS_FILE, DATA_FILE_NAME};

fn local_config_path(root: &Path, relative_path: &str) -> PathBuf {
    root.join(relative_path)
}

fn read_local_file_if_exists(
    root: &Path,
    relative_path: &str,
    files: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    let path = local_config_path(root, relative_path);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        files.insert(relative_path.to_string(), content);
    }
    Ok(())
}

fn write_file_if_needed(path: &Path, content: &str) -> Result<bool, String> {
    if path.exists() {
        let existing = fs::read_to_string(path).map_err(|error| error.to_string())?;
        if existing == content {
            return Ok(false);
        }
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(true)
}

fn cleanup_stale_local_channel_files(
    root: &Path,
    files: &BTreeMap<String, String>,
) -> Result<bool, String> {
    let mut changed = false;
    let channels_dir = root.join(CHAT_CHANNELS_DIR);
    if !channels_dir.exists() {
        return Ok(false);
    }

    let expected_files = files
        .keys()
        .filter(|path| path.starts_with("chat/channels/"))
        .map(|path| channels_dir.join(path.trim_start_matches("chat/channels/")))
        .collect::<BTreeSet<_>>();

    for entry in fs::read_dir(&channels_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        if expected_files.contains(&path) {
            continue;
        }
        fs::remove_file(&path).map_err(|error| error.to_string())?;
        changed = true;
    }

    Ok(changed)
}

pub(crate) fn load_local_config_files(root: &Path) -> Result<BTreeMap<String, String>, String> {
    let mut files = BTreeMap::new();

    read_local_file_if_exists(root, DATA_FILE_NAME, &mut files)?;
    read_local_file_if_exists(root, CHAT_SESSIONS_FILE, &mut files)?;

    let channels_dir = root.join(CHAT_CHANNELS_DIR);
    if channels_dir.exists() {
        for entry in fs::read_dir(&channels_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }

            let file_name = entry.file_name();
            let relative_path = format!("chat/channels/{}", file_name.to_string_lossy());
            let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
            files.insert(relative_path, content);
        }
    }

    Ok(files)
}

pub(crate) fn apply_remote_files_to_local(
    root: &Path,
    remote_files: &BTreeMap<String, String>,
    missing_only: bool,
) -> Result<bool, String> {
    let mut changed = false;

    for (relative_path, content) in remote_files {
        let local_path = local_config_path(root, relative_path);
        if missing_only && local_path.exists() {
            continue;
        }
        changed |= write_file_if_needed(&local_path, content)?;
    }

    if !missing_only {
        changed |= cleanup_stale_local_channel_files(root, remote_files)?;
    }

    Ok(changed)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::fs;

    use tempfile::tempdir;

    use super::{apply_remote_files_to_local, load_local_config_files};

    #[test]
    fn loads_local_config_files_from_main_and_channel_paths() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        fs::write(root.join("data.json"), "{}").unwrap();
        fs::create_dir_all(root.join("chat/channels")).unwrap();
        fs::write(root.join("chat/sessions.json"), "{\"sessions\":[]}").unwrap();
        fs::write(root.join("chat/channels/provider.json"), "{\"provider\":1}").unwrap();

        let files = load_local_config_files(root).unwrap();

        assert_eq!(files.len(), 3);
        assert!(files.contains_key("data.json"));
        assert!(files.contains_key("chat/sessions.json"));
        assert!(files.contains_key("chat/channels/provider.json"));
    }

    #[test]
    fn applies_remote_files_only_when_missing_in_missing_only_mode() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        fs::write(root.join("data.json"), "{\"local\":true}").unwrap();

        let remote_files = BTreeMap::from([
            ("data.json".to_string(), "{\"remote\":true}".to_string()),
            (
                "chat/channels/provider.json".to_string(),
                "{\"provider\":1}".to_string(),
            ),
        ]);

        let changed = apply_remote_files_to_local(root, &remote_files, true).unwrap();

        assert!(changed);
        assert_eq!(fs::read_to_string(root.join("data.json")).unwrap(), "{\"local\":true}");
        assert_eq!(
            fs::read_to_string(root.join("chat/channels/provider.json")).unwrap(),
            "{\"provider\":1}"
        );
    }

    #[test]
    fn restore_mode_cleans_up_stale_channel_files() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        fs::create_dir_all(root.join("chat/channels")).unwrap();
        fs::write(root.join("chat/channels/stale.json"), "{\"stale\":true}").unwrap();

        let remote_files = BTreeMap::from([(
            "chat/channels/current.json".to_string(),
            "{\"current\":true}".to_string(),
        )]);

        let changed = apply_remote_files_to_local(root, &remote_files, false).unwrap();

        assert!(changed);
        assert!(!root.join("chat/channels/stale.json").exists());
        assert_eq!(
            fs::read_to_string(root.join("chat/channels/current.json")).unwrap(),
            "{\"current\":true}"
        );
    }
}
