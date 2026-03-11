use crate::github::credentials::CONFIG_REPO_NAME;
use crate::github::types::Repository;

pub(crate) const NEKOTICK_PREFIX: &str = "nekotick-";
pub(crate) const MANAGED_CONTENT_REPO_NAME_ERROR: &str =
    "Only NekoTick cloud repositories can be accessed";
pub(crate) const MANAGED_CONFIG_REPO_NAME_ERROR: &str =
    "Only the NekoTick config repository can be accessed";
pub(crate) const MANAGED_CONTENT_REPO_ACCESS_ERROR: &str =
    "Only discovered NekoTick cloud repositories can be accessed";

fn normalized_repo_name(name: &str) -> String {
    name.trim().to_ascii_lowercase()
}

pub fn get_display_name(name: &str) -> String {
    if name.starts_with(NEKOTICK_PREFIX) {
        name[NEKOTICK_PREFIX.len()..].to_string()
    } else {
        name.to_string()
    }
}

pub fn is_managed_config_repo_name(name: &str) -> bool {
    normalized_repo_name(name) == CONFIG_REPO_NAME
}

pub fn is_managed_content_repo_name(name: &str) -> bool {
    let normalized = normalized_repo_name(name);
    normalized.starts_with(NEKOTICK_PREFIX) && normalized != CONFIG_REPO_NAME
}

pub fn normalize_managed_content_repo_name(name: &str) -> String {
    let trimmed = name.trim();
    if is_managed_content_repo_name(trimmed) {
        return trimmed.to_string();
    }
    format!("{}{}", NEKOTICK_PREFIX, trimmed)
}

pub fn ensure_managed_content_repo_name(name: &str) -> Result<(), String> {
    if is_managed_content_repo_name(name) {
        return Ok(());
    }
    Err(MANAGED_CONTENT_REPO_NAME_ERROR.to_string())
}

pub fn has_managed_content_repo_access(repos: &[Repository], owner: &str, name: &str) -> bool {
    let normalized_owner = normalized_repo_name(owner);
    let normalized_name = normalized_repo_name(name);

    repos.iter().any(|repo| {
        is_managed_content_repo_name(&repo.name)
            && normalized_repo_name(&repo.owner.login) == normalized_owner
            && normalized_repo_name(&repo.name) == normalized_name
    })
}

pub fn ensure_managed_content_repo_access(
    repos: &[Repository],
    owner: &str,
    name: &str,
) -> Result<(), String> {
    if has_managed_content_repo_access(repos, owner, name) {
        return Ok(());
    }
    Err(MANAGED_CONTENT_REPO_ACCESS_ERROR.to_string())
}

pub fn ensure_managed_config_repo_name(name: &str) -> Result<(), String> {
    if is_managed_config_repo_name(name) {
        return Ok(());
    }
    Err(MANAGED_CONFIG_REPO_NAME_ERROR.to_string())
}

pub fn filter_managed_content_repos(repos: Vec<Repository>) -> Vec<Repository> {
    repos
        .into_iter()
        .filter(|repo| is_managed_content_repo_name(&repo.name))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        ensure_managed_config_repo_name, ensure_managed_content_repo_access,
        ensure_managed_content_repo_name, has_managed_content_repo_access,
        is_managed_config_repo_name, is_managed_content_repo_name,
        normalize_managed_content_repo_name,
    };
    use crate::github::types::{Repository, RepositoryOwner};

    fn create_repository(owner: &str, name: &str) -> Repository {
        Repository {
            id: 1,
            name: name.to_string(),
            full_name: format!("{owner}/{name}"),
            owner: RepositoryOwner {
                login: owner.to_string(),
                id: 1,
            },
            private: true,
            html_url: format!("https://example.test/{owner}/{name}"),
            default_branch: "main".to_string(),
            updated_at: "2026-03-11T00:00:00Z".to_string(),
            description: None,
        }
    }

    #[test]
    fn recognizes_content_repositories_case_insensitively() {
        assert!(is_managed_content_repo_name("nekotick-notes"));
        assert!(is_managed_content_repo_name("NekoTick-Notes"));
        assert!(!is_managed_content_repo_name("nekotick-config"));
        assert!(!is_managed_content_repo_name("notes"));
    }

    #[test]
    fn normalizes_content_repository_creation_inputs() {
        assert_eq!(
            normalize_managed_content_repo_name("notes"),
            "nekotick-notes"
        );
        assert_eq!(
            normalize_managed_content_repo_name("nekotick-notes"),
            "nekotick-notes"
        );
        assert_eq!(
            normalize_managed_content_repo_name("NekoTick-Notes"),
            "NekoTick-Notes"
        );
    }

    #[test]
    fn rejects_non_managed_repository_names() {
        assert!(ensure_managed_content_repo_name("notes").is_err());
        assert!(ensure_managed_content_repo_name("nekotick-config").is_err());
        assert!(ensure_managed_config_repo_name("nekotick-notes").is_err());
        assert!(ensure_managed_config_repo_name("nekotick-config").is_ok());
        assert!(is_managed_config_repo_name("NekoTick-Config"));
    }

    #[test]
    fn enforces_exact_access_against_discovered_managed_repositories() {
        let repos = vec![
            create_repository("alice", "nekotick-notes"),
            create_repository("team", "nekotick-shared"),
            create_repository("alice", "nekotick-config"),
        ];

        assert!(has_managed_content_repo_access(
            &repos,
            "alice",
            "nekotick-notes"
        ));
        assert!(has_managed_content_repo_access(
            &repos,
            "TEAM",
            "NekoTick-Shared"
        ));
        assert!(!has_managed_content_repo_access(
            &repos,
            "bob",
            "nekotick-notes"
        ));
        assert!(!has_managed_content_repo_access(
            &repos,
            "alice",
            "nekotick-config"
        ));
        assert!(ensure_managed_content_repo_access(&repos, "team", "nekotick-shared").is_ok());
        assert!(ensure_managed_content_repo_access(&repos, "team", "other").is_err());
    }
}
