use crate::github::types::{GitHubUser, Repository, TreeEntry};

use super::api_types::{
    CreateRepoRequest, GitCommitLookupResponse, GitReferenceResponse, GitTreeResponse,
};
use super::client::{RepoClient, GITHUB_API_BASE};
use super::error::RepoApiError;
use super::naming::{filter_nekotick_repos, NEKOTICK_PREFIX};

impl RepoClient {
    pub async fn get_user_info(&self) -> Result<GitHubUser, RepoApiError> {
        let response = self
            .client
            .get(format!("{}/user", GITHUB_API_BASE))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        self.parse_json(response).await
    }

    pub async fn find_repo_by_name(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<Option<Repository>, RepoApiError> {
        let response = self
            .client
            .get(format!("{}/repos/{}/{}", GITHUB_API_BASE, owner, name))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        self.parse_json(response).await.map(Some)
    }

    pub async fn list_nekotick_repos(&self) -> Result<Vec<Repository>, RepoApiError> {
        let mut all_repos = Vec::new();
        let mut page = 1;

        loop {
            let response = self
                .client
                .get(format!("{}/user/repos", GITHUB_API_BASE))
                .headers(self.build_headers())
                .query(&[
                    ("per_page", "100"),
                    ("page", &page.to_string()),
                    ("sort", "updated"),
                    ("direction", "desc"),
                ])
                .send()
                .await
                .map_err(|error| RepoApiError::NetworkError(error.to_string()))?;

            if !response.status().is_success() {
                return Err(self.handle_error(response).await);
            }

            let repos: Vec<Repository> = self.parse_json(response).await?;
            if repos.is_empty() {
                break;
            }

            all_repos.extend(filter_nekotick_repos(repos));
            page += 1;
            if page > 10 {
                break;
            }
        }

        Ok(all_repos)
    }

    pub async fn create_repo(
        &self,
        name: &str,
        private: bool,
        description: Option<&str>,
    ) -> Result<Repository, RepoApiError> {
        let full_name = if name.starts_with(NEKOTICK_PREFIX) {
            name.to_string()
        } else {
            format!("{}{}", NEKOTICK_PREFIX, name)
        };

        let response = self
            .client
            .post(format!("{}/user/repos", GITHUB_API_BASE))
            .headers(self.build_headers())
            .json(&CreateRepoRequest {
                name: full_name,
                description: description.map(str::to_string),
                private,
                auto_init: true,
            })
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        self.parse_json(response).await
    }

    pub async fn get_repo_recursive_tree(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
    ) -> Result<Vec<TreeEntry>, RepoApiError> {
        let reference_response: GitReferenceResponse = self
            .client
            .get(format!(
                "{}/repos/{}/{}/git/ref/heads/{}",
                GITHUB_API_BASE, owner, repo, branch
            ))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?
            .json()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))?;

        let commit_lookup: GitCommitLookupResponse = self
            .client
            .get(format!(
                "{}/repos/{}/{}/git/commits/{}",
                GITHUB_API_BASE, owner, repo, reference_response.object.sha
            ))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?
            .json()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))?;

        let tree_response: GitTreeResponse = self
            .client
            .get(format!(
                "{}/repos/{}/{}/git/trees/{}?recursive=1",
                GITHUB_API_BASE, owner, repo, commit_lookup.tree.sha
            ))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?
            .json()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))?;

        let mut entries = tree_response
            .tree
            .into_iter()
            .filter_map(|item| {
                let sha = item.sha?;
                let name = item.path.rsplit('/').next()?.to_string();
                Some(TreeEntry {
                    path: item.path,
                    name,
                    entry_type: if item.item_type == "tree" {
                        "dir".to_string()
                    } else {
                        "file".to_string()
                    },
                    sha,
                    size: None,
                })
            })
            .collect::<Vec<_>>();

        entries.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(entries)
    }
}
