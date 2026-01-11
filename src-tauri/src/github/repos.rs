//! GitHub Repository API client
//!
//! Provides methods to interact with GitHub Repository API for browsing
//! and managing user repositories with `nekotick-` prefix.

use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose::STANDARD, Engine};

const GITHUB_API_BASE: &str = "https://api.github.com";
const NEKOTICK_PREFIX: &str = "nekotick-";

/// GitHub repository info (from GitHub API - uses snake_case)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: RepositoryOwner,
    pub private: bool,
    pub html_url: String,
    pub default_branch: String,
    pub updated_at: String,
    pub description: Option<String>,
}

/// Repository owner info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryOwner {
    pub login: String,
    pub id: u64,
}

/// Tree entry (file or directory) - for frontend (camelCase)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeEntry {
    pub path: String,
    pub name: String,
    pub entry_type: String,  // "file" or "dir"
    pub sha: String,
    pub size: Option<u64>,
}

/// File content from GitHub API - for frontend (camelCase)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub sha: String,
    pub encoding: String,
}

/// Commit result after file update - for frontend (camelCase)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitResult {
    pub sha: String,
    pub message: String,
    pub html_url: Option<String>,
}

/// Create repository request
#[derive(Debug, Clone, Serialize)]
pub struct CreateRepoRequest {
    pub name: String,
    pub description: Option<String>,
    pub private: bool,
    pub auto_init: bool,
}

/// Update file request
#[derive(Debug, Clone, Serialize)]
pub struct UpdateFileRequest {
    pub message: String,
    pub content: String,
    pub sha: Option<String>,
    pub branch: Option<String>,
}

/// GitHub API response for contents
#[derive(Debug, Clone, Deserialize)]
struct ContentsResponse {
    name: String,
    path: String,
    sha: String,
    size: Option<u64>,
    #[serde(rename = "type")]
    content_type: String,
    content: Option<String>,
    encoding: Option<String>,
}

/// GitHub API response for commit
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct CommitResponse {
    content: Option<ContentInfo>,
    commit: CommitInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct ContentInfo {
    sha: String,
}

#[derive(Debug, Clone, Deserialize)]
struct CommitInfo {
    sha: String,
    message: String,
    html_url: Option<String>,
}

/// Error types for Repository API operations
#[derive(Debug, thiserror::Error)]
pub enum RepoApiError {
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Rate limited")]
    RateLimited,
    #[error("Conflict: {0}")]
    Conflict(String),
}

/// GitHub Repository API client
pub struct RepoClient {
    access_token: String,
    client: reqwest::Client,
}

impl RepoClient {
    /// Create a new Repository client
    pub fn new(access_token: String) -> Self {
        Self {
            access_token,
            client: reqwest::Client::new(),
        }
    }

    /// Build common headers for GitHub API requests
    fn build_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "Authorization",
            format!("Bearer {}", self.access_token).parse().unwrap(),
        );
        headers.insert(
            "Accept",
            "application/vnd.github+json".parse().unwrap(),
        );
        headers.insert("User-Agent", "NekoTick".parse().unwrap());
        headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
        headers
    }

    /// Handle API response errors
    async fn handle_error(&self, response: reqwest::Response) -> RepoApiError {
        let status = response.status();
        
        if status == 401 {
            return RepoApiError::Unauthorized;
        }
        
        if status == 403 {
            // Check for rate limiting
            if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
                if remaining.to_str().unwrap_or("1") == "0" {
                    return RepoApiError::RateLimited;
                }
            }
        }
        
        if status == 404 {
            return RepoApiError::NotFound("Resource not found".to_string());
        }
        
        if status == 409 {
            let error_text = response.text().await.unwrap_or_default();
            return RepoApiError::Conflict(error_text);
        }
        
        let error_text = response.text().await.unwrap_or_default();
        RepoApiError::ApiError(format!("{}: {}", status, error_text))
    }

    /// List user's repositories with nekotick- prefix
    pub async fn list_nekotick_repos(&self) -> Result<Vec<Repository>, RepoApiError> {
        let mut all_repos = Vec::new();
        let mut page = 1;
        
        loop {
            let response = self.client
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
                .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

            if !response.status().is_success() {
                return Err(self.handle_error(response).await);
            }

            let repos: Vec<Repository> = response
                .json()
                .await
                .map_err(|e| RepoApiError::ParseError(e.to_string()))?;

            if repos.is_empty() {
                break;
            }

            // Filter repos with nekotick- prefix
            let nekotick_repos: Vec<Repository> = repos
                .into_iter()
                .filter(|r| r.name.starts_with(NEKOTICK_PREFIX))
                .collect();

            all_repos.extend(nekotick_repos);
            page += 1;
            
            // Safety limit
            if page > 10 {
                break;
            }
        }

        Ok(all_repos)
    }

    /// Get repository directory contents
    pub async fn get_repo_contents(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<Vec<TreeEntry>, RepoApiError> {
        let url = if path.is_empty() {
            format!("{}/repos/{}/{}/contents", GITHUB_API_BASE, owner, repo)
        } else {
            format!("{}/repos/{}/{}/contents/{}", GITHUB_API_BASE, owner, repo, path)
        };

        let response = self.client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        let contents: Vec<ContentsResponse> = response
            .json()
            .await
            .map_err(|e| RepoApiError::ParseError(e.to_string()))?;

        let entries: Vec<TreeEntry> = contents
            .into_iter()
            .map(|c| TreeEntry {
                path: c.path.clone(),
                name: c.name,
                entry_type: if c.content_type == "dir" { "dir".to_string() } else { "file".to_string() },
                sha: c.sha,
                size: c.size,
            })
            .collect();

        Ok(entries)
    }

    /// Get file content from repository
    pub async fn get_file_content(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<FileContent, RepoApiError> {
        let url = format!("{}/repos/{}/{}/contents/{}", GITHUB_API_BASE, owner, repo, path);

        let response = self.client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        let content_response: ContentsResponse = response
            .json()
            .await
            .map_err(|e| RepoApiError::ParseError(e.to_string()))?;

        // Decode base64 content
        let raw_content = content_response.content.unwrap_or_default();
        let cleaned_content = raw_content.replace('\n', "").replace('\r', "");
        
        let decoded_content = STANDARD
            .decode(&cleaned_content)
            .map_err(|e| RepoApiError::ParseError(format!("Base64 decode error: {}", e)))?;
        
        let content_str = String::from_utf8(decoded_content)
            .map_err(|e| RepoApiError::ParseError(format!("UTF-8 decode error: {}", e)))?;

        Ok(FileContent {
            path: content_response.path,
            content: content_str,
            sha: content_response.sha,
            encoding: content_response.encoding.unwrap_or_else(|| "base64".to_string()),
        })
    }

    /// Update or create a file in repository
    pub async fn update_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        content: &str,
        sha: Option<&str>,
        message: &str,
    ) -> Result<CommitResult, RepoApiError> {
        let url = format!("{}/repos/{}/{}/contents/{}", GITHUB_API_BASE, owner, repo, path);

        // Encode content to base64
        let encoded_content = STANDARD.encode(content.as_bytes());

        let request = UpdateFileRequest {
            message: message.to_string(),
            content: encoded_content,
            sha: sha.map(|s| s.to_string()),
            branch: None,
        };

        let response = self.client
            .put(&url)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        let commit_response: CommitResponse = response
            .json()
            .await
            .map_err(|e| RepoApiError::ParseError(e.to_string()))?;

        Ok(CommitResult {
            sha: commit_response.commit.sha,
            message: commit_response.commit.message,
            html_url: commit_response.commit.html_url,
        })
    }

    /// Create a new repository with nekotick- prefix
    pub async fn create_repo(
        &self,
        name: &str,
        private: bool,
        description: Option<&str>,
    ) -> Result<Repository, RepoApiError> {
        // Ensure name has nekotick- prefix
        let full_name = if name.starts_with(NEKOTICK_PREFIX) {
            name.to_string()
        } else {
            format!("{}{}", NEKOTICK_PREFIX, name)
        };

        let request = CreateRepoRequest {
            name: full_name,
            description: description.map(|s| s.to_string()),
            private,
            auto_init: true, // Initialize with README
        };

        let response = self.client
            .post(format!("{}/user/repos", GITHUB_API_BASE))
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        response
            .json()
            .await
            .map_err(|e| RepoApiError::ParseError(e.to_string()))
    }

    /// Delete a file from repository
    pub async fn delete_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        sha: &str,
        message: &str,
    ) -> Result<CommitResult, RepoApiError> {
        let url = format!("{}/repos/{}/{}/contents/{}", GITHUB_API_BASE, owner, repo, path);

        let request = serde_json::json!({
            "message": message,
            "sha": sha
        });

        let response = self.client
            .delete(&url)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| RepoApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        let commit_response: CommitResponse = response
            .json()
            .await
            .map_err(|e| RepoApiError::ParseError(e.to_string()))?;

        Ok(CommitResult {
            sha: commit_response.commit.sha,
            message: commit_response.commit.message,
            html_url: commit_response.commit.html_url,
        })
    }
}

/// Get display name by removing nekotick- prefix
pub fn get_display_name(name: &str) -> String {
    if name.starts_with(NEKOTICK_PREFIX) {
        name[NEKOTICK_PREFIX.len()..].to_string()
    } else {
        name.to_string()
    }
}

/// Filter repositories to only include nekotick- prefixed ones
pub fn filter_nekotick_repos(repos: Vec<Repository>) -> Vec<Repository> {
    repos.into_iter()
        .filter(|r| r.name.starts_with(NEKOTICK_PREFIX))
        .collect()
}
