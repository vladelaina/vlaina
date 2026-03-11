use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::github::types::RepoCommittedFile;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateRepoRequest {
    pub name: String,
    pub description: Option<String>,
    pub private: bool,
    pub auto_init: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ContentsResponse {
    pub path: String,
    pub sha: String,
    pub content: Option<String>,
    pub encoding: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitReferenceResponse {
    pub object: GitReferenceObject,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitReferenceObject {
    pub sha: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitCommitLookupResponse {
    pub tree: GitReferenceObject,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitTreeResponse {
    pub sha: String,
    pub tree: Vec<GitTreeItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GitTreeItem {
    pub path: String,
    pub sha: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateBlobRequest {
    pub content: String,
    pub encoding: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateBlobResponse {
    pub sha: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateTreeRequest {
    pub base_tree: String,
    pub tree: Vec<CreateTreeItem>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateTreeItem {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub sha: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateTreeResponse {
    pub sha: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateCommitRequest {
    pub message: String,
    pub tree: String,
    pub parents: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateCommitResponse {
    pub sha: String,
    pub html_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct UpdateRefRequest {
    pub sha: String,
    pub force: bool,
}

pub(crate) struct ChangesetBaseState {
    pub head_commit_sha: String,
    pub tree_sha: String,
    pub current_file_shas: HashMap<String, String>,
}

pub(crate) struct CreatedChangesetTree {
    pub updated_files: Vec<RepoCommittedFile>,
    pub tree_items: Vec<CreateTreeItem>,
}
