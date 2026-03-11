use crate::github::types::{CommitResult, RepoChangeOperation, RepoChangesetCommitResult};

use super::api_types::{
    ChangesetBaseState, CreateBlobRequest, CreateBlobResponse, CreateCommitRequest,
    CreateCommitResponse, CreateTreeItem, CreateTreeRequest, CreateTreeResponse,
    CreatedChangesetTree, GitCommitLookupResponse, GitReferenceResponse, GitTreeResponse,
    UpdateRefRequest,
};
use super::changeset_support::detect_changeset_conflicts;
use super::client::{RepoClient, GITHUB_API_BASE};
use super::error::RepoApiError;

impl RepoClient {
    async fn load_changeset_base(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
    ) -> Result<ChangesetBaseState, RepoApiError> {
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

        Ok(ChangesetBaseState {
            head_commit_sha: reference_response.object.sha,
            tree_sha: tree_response.sha,
            current_file_shas: tree_response
                .tree
                .into_iter()
                .filter(|item| item.item_type == "blob")
                .filter_map(|item| item.sha.map(|sha| (item.path, sha)))
                .collect(),
        })
    }

    async fn create_changeset_tree_items(
        &self,
        owner: &str,
        repo: &str,
        operations: &[RepoChangeOperation],
    ) -> Result<CreatedChangesetTree, RepoApiError> {
        let mut tree_items = Vec::new();
        let mut updated_files = Vec::new();

        for operation in operations {
            match operation.operation_type.as_str() {
                "upsert" => {
                    let blob_response: CreateBlobResponse = self
                        .client
                        .post(format!(
                            "{}/repos/{}/{}/git/blobs",
                            GITHUB_API_BASE, owner, repo
                        ))
                        .headers(self.build_headers())
                        .json(&CreateBlobRequest {
                            content: operation.content.clone().unwrap_or_default(),
                            encoding: "utf-8".to_string(),
                        })
                        .send()
                        .await
                        .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
                        .error_for_status()
                        .map_err(|error| RepoApiError::ApiError(error.to_string()))?
                        .json()
                        .await
                        .map_err(|error| RepoApiError::ParseError(error.to_string()))?;

                    updated_files.push(crate::github::types::RepoCommittedFile {
                        path: operation.path.clone(),
                        sha: blob_response.sha.clone(),
                    });
                    tree_items.push(CreateTreeItem {
                        path: operation.path.clone(),
                        mode: "100644".to_string(),
                        item_type: "blob".to_string(),
                        sha: Some(blob_response.sha),
                    });
                }
                "delete" => {
                    tree_items.push(CreateTreeItem {
                        path: operation.path.clone(),
                        mode: "100644".to_string(),
                        item_type: "blob".to_string(),
                        sha: None,
                    });
                }
                other => {
                    return Err(RepoApiError::ApiError(format!(
                        "Unsupported changeset operation: {}",
                        other
                    )));
                }
            }
        }

        Ok(CreatedChangesetTree {
            updated_files,
            tree_items,
        })
    }

    async fn create_changeset_commit(
        &self,
        owner: &str,
        repo: &str,
        message: &str,
        head_commit_sha: &str,
        tree_sha: &str,
        tree_items: Vec<CreateTreeItem>,
    ) -> Result<CreateCommitResponse, RepoApiError> {
        let created_tree: CreateTreeResponse = self
            .client
            .post(format!(
                "{}/repos/{}/{}/git/trees",
                GITHUB_API_BASE, owner, repo
            ))
            .headers(self.build_headers())
            .json(&CreateTreeRequest {
                base_tree: tree_sha.to_string(),
                tree: tree_items,
            })
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?
            .json()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))?;

        self.client
            .post(format!(
                "{}/repos/{}/{}/git/commits",
                GITHUB_API_BASE, owner, repo
            ))
            .headers(self.build_headers())
            .json(&CreateCommitRequest {
                message: message.to_string(),
                tree: created_tree.sha,
                parents: vec![head_commit_sha.to_string()],
            })
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?
            .json()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))
    }

    async fn update_branch_reference(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        commit_sha: &str,
    ) -> Result<(), RepoApiError> {
        self.client
            .patch(format!(
                "{}/repos/{}/{}/git/refs/heads/{}",
                GITHUB_API_BASE, owner, repo, branch
            ))
            .headers(self.build_headers())
            .json(&UpdateRefRequest {
                sha: commit_sha.to_string(),
                force: false,
            })
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?
            .error_for_status()
            .map_err(|error| RepoApiError::ApiError(error.to_string()))?;

        Ok(())
    }

    pub async fn commit_changeset(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        message: &str,
        operations: &[RepoChangeOperation],
    ) -> Result<RepoChangesetCommitResult, RepoApiError> {
        if operations.is_empty() {
            return Ok(RepoChangesetCommitResult {
                status: "committed".to_string(),
                commit: None,
                conflicts: Vec::new(),
                updated_files: Vec::new(),
            });
        }

        let base_state = self.load_changeset_base(owner, repo, branch).await?;
        let conflicts = detect_changeset_conflicts(operations, &base_state.current_file_shas);
        if !conflicts.is_empty() {
            return Ok(RepoChangesetCommitResult {
                status: "conflict".to_string(),
                commit: None,
                conflicts,
                updated_files: Vec::new(),
            });
        }

        let CreatedChangesetTree {
            updated_files,
            tree_items,
        } = self
            .create_changeset_tree_items(owner, repo, operations)
            .await?;
        let created_commit = self
            .create_changeset_commit(
                owner,
                repo,
                message,
                &base_state.head_commit_sha,
                &base_state.tree_sha,
                tree_items,
            )
            .await?;
        self.update_branch_reference(owner, repo, branch, &created_commit.sha)
            .await?;

        Ok(RepoChangesetCommitResult {
            status: "committed".to_string(),
            commit: Some(CommitResult {
                sha: created_commit.sha,
                message: message.to_string(),
                html_url: created_commit.html_url,
            }),
            conflicts: Vec::new(),
            updated_files,
        })
    }
}
