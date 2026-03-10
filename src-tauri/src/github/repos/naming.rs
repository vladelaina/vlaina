use crate::github::types::Repository;
use crate::github::credentials::CONFIG_REPO_NAME;

pub(crate) const NEKOTICK_PREFIX: &str = "nekotick-";

pub fn get_display_name(name: &str) -> String {
    if name.starts_with(NEKOTICK_PREFIX) {
        name[NEKOTICK_PREFIX.len()..].to_string()
    } else {
        name.to_string()
    }
}

pub fn filter_nekotick_repos(repos: Vec<Repository>) -> Vec<Repository> {
    repos.into_iter()
        .filter(|repo| repo.name.starts_with(NEKOTICK_PREFIX) && repo.name != CONFIG_REPO_NAME)
        .collect()
}
