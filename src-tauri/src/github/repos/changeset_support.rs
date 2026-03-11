use std::collections::HashMap;

use crate::github::types::{RepoChangeOperation, RepoCommitConflict};

pub(crate) fn detect_changeset_conflict_reason(
    previous_sha: Option<&str>,
    current_sha: Option<&str>,
) -> Option<&'static str> {
    if previous_sha == current_sha {
        return None;
    }

    Some(match (previous_sha, current_sha) {
        (Some(_), Some(_)) => "modified",
        (Some(_), None) => "deleted",
        (None, Some(_)) => "created",
        (None, None) => unreachable!("equal sha pairs return early"),
    })
}

pub(crate) fn detect_changeset_conflicts(
    operations: &[RepoChangeOperation],
    current_file_shas: &HashMap<String, String>,
) -> Vec<RepoCommitConflict> {
    operations
        .iter()
        .filter_map(|operation| {
            let reason = detect_changeset_conflict_reason(
                operation.previous_sha.as_deref(),
                current_file_shas.get(&operation.path).map(String::as_str),
            )?;

            Some(RepoCommitConflict {
                path: operation.path.clone(),
                reason: reason.to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::github::types::RepoChangeOperation;

    use super::{detect_changeset_conflict_reason, detect_changeset_conflicts};

    fn operation(path: &str, previous_sha: Option<&str>) -> RepoChangeOperation {
        RepoChangeOperation {
            operation_type: "upsert".to_string(),
            path: path.to_string(),
            content: None,
            previous_sha: previous_sha.map(str::to_string),
        }
    }

    #[test]
    fn detect_changeset_conflict_reason_supports_all_semantics() {
        assert_eq!(
            detect_changeset_conflict_reason(Some("before"), Some("after")),
            Some("modified")
        );
        assert_eq!(
            detect_changeset_conflict_reason(Some("before"), None),
            Some("deleted")
        );
        assert_eq!(
            detect_changeset_conflict_reason(None, Some("after")),
            Some("created")
        );
        assert_eq!(detect_changeset_conflict_reason(None, None), None);
        assert_eq!(
            detect_changeset_conflict_reason(Some("same"), Some("same")),
            None
        );
    }

    #[test]
    fn detect_changeset_conflicts_returns_reason_per_path() {
        let operations = vec![
            operation("modified.md", Some("before")),
            operation("deleted.md", Some("before")),
            operation("created.md", None),
            operation("missing.md", None),
            operation("clean.md", Some("same")),
        ];

        let current_file_shas = HashMap::from([
            ("modified.md".to_string(), "after".to_string()),
            ("created.md".to_string(), "after".to_string()),
            ("clean.md".to_string(), "same".to_string()),
        ]);

        let conflicts = detect_changeset_conflicts(&operations, &current_file_shas);
        let reasons: HashMap<_, _> = conflicts
            .into_iter()
            .map(|conflict| (conflict.path, conflict.reason))
            .collect();

        assert_eq!(reasons.get("modified.md"), Some(&"modified".to_string()));
        assert_eq!(reasons.get("deleted.md"), Some(&"deleted".to_string()));
        assert_eq!(reasons.get("created.md"), Some(&"created".to_string()));
        assert!(!reasons.contains_key("missing.md"));
        assert!(!reasons.contains_key("clean.md"));
    }
}
