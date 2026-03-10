use std::collections::BTreeMap;

use crate::github::types::{RepoChangeOperation, TreeEntry};

pub(crate) const DATA_FILE_NAME: &str = "data.json";
pub(crate) const CHAT_SESSIONS_FILE: &str = "chat/sessions.json";
pub(crate) const CHAT_CHANNELS_DIR: &str = "chat/channels";

pub(crate) fn is_config_channel_path(path: &str) -> bool {
    path.starts_with("chat/channels/") && path.ends_with(".json")
}

pub(crate) fn is_tracked_config_path(path: &str) -> bool {
    path == DATA_FILE_NAME || path == CHAT_SESSIONS_FILE || is_config_channel_path(path)
}

pub(crate) fn filter_config_remote_shas(
    entries: Vec<TreeEntry>,
) -> BTreeMap<String, String> {
    entries
        .into_iter()
        .filter(|entry| entry.entry_type == "file")
        .filter(|entry| is_tracked_config_path(&entry.path))
        .map(|entry| (entry.path, entry.sha))
        .collect()
}

pub(crate) fn build_config_sync_operations(
    local_files: &BTreeMap<String, String>,
    remote_shas: &BTreeMap<String, String>,
) -> Vec<RepoChangeOperation> {
    let mut operations = Vec::new();

    for (path, content) in local_files {
        operations.push(RepoChangeOperation {
            operation_type: "upsert".to_string(),
            path: path.clone(),
            content: Some(content.clone()),
            previous_sha: remote_shas.get(path).cloned(),
        });
    }

    for (path, sha) in remote_shas {
        if is_config_channel_path(path) && !local_files.contains_key(path) {
            operations.push(RepoChangeOperation {
                operation_type: "delete".to_string(),
                path: path.clone(),
                content: None,
                previous_sha: Some(sha.clone()),
            });
        }
    }

    operations
}

#[cfg(test)]
mod tests {
    use super::{
        build_config_sync_operations, filter_config_remote_shas, is_config_channel_path,
        is_tracked_config_path,
    };
    use crate::github::types::TreeEntry;

    fn create_entry(path: &str, entry_type: &str) -> TreeEntry {
        TreeEntry {
            path: path.to_string(),
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            entry_type: entry_type.to_string(),
            sha: format!("sha:{path}"),
            size: None,
        }
    }

    #[test]
    fn tracks_only_supported_config_paths() {
        assert!(is_tracked_config_path("data.json"));
        assert!(is_tracked_config_path("chat/sessions.json"));
        assert!(is_tracked_config_path("chat/channels/provider.json"));
        assert!(!is_tracked_config_path("README.md"));
        assert!(!is_tracked_config_path("chat/channels/provider.txt"));
        assert!(is_config_channel_path("chat/channels/provider.json"));
    }

    #[test]
    fn filters_remote_tree_to_tracked_files() {
        let shas = filter_config_remote_shas(vec![
            create_entry("data.json", "file"),
            create_entry("chat/channels/provider.json", "file"),
            create_entry("README.md", "file"),
            create_entry("chat", "dir"),
        ]);

        assert_eq!(shas.len(), 2);
        assert!(shas.contains_key("data.json"));
        assert!(shas.contains_key("chat/channels/provider.json"));
    }

    #[test]
    fn builds_upserts_and_channel_deletes_from_local_state() {
        let local_files = [
            ("data.json".to_string(), "{}".to_string()),
            (
                "chat/channels/current.json".to_string(),
                "{\"provider\":1}".to_string(),
            ),
        ]
        .into_iter()
        .collect();

        let remote_shas = [
            ("data.json".to_string(), "sha-data".to_string()),
            (
                "chat/channels/stale.json".to_string(),
                "sha-stale".to_string(),
            ),
        ]
        .into_iter()
        .collect();

        let operations = build_config_sync_operations(&local_files, &remote_shas);

        assert_eq!(operations.len(), 3);
        assert!(operations.iter().any(|operation| {
            operation.operation_type == "upsert"
                && operation.path == "data.json"
                && operation.previous_sha.as_deref() == Some("sha-data")
        }));
        assert!(operations.iter().any(|operation| {
            operation.operation_type == "upsert"
                && operation.path == "chat/channels/current.json"
                && operation.previous_sha.is_none()
        }));
        assert!(operations.iter().any(|operation| {
            operation.operation_type == "delete"
                && operation.path == "chat/channels/stale.json"
                && operation.previous_sha.as_deref() == Some("sha-stale")
        }));
    }
}
