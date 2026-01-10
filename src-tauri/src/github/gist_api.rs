//! GitHub Gist API client
//!
//! Provides methods to interact with GitHub Gist API for sync operations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const GITHUB_API_BASE: &str = "https://api.github.com";
const NEKOTICK_GIST_DESCRIPTION: &str = "NekoTick Sync Data";
const DATA_FILE_NAME: &str = "data.json";

/// GitHub user info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: u64,
    pub avatar_url: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
}

/// Gist file content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GistFile {
    pub filename: Option<String>,
    pub content: Option<String>,
    pub raw_url: Option<String>,
    pub size: Option<u64>,
}

/// Gist response from GitHub API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gist {
    pub id: String,
    pub description: Option<String>,
    pub public: bool,
    pub files: HashMap<String, GistFile>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: Option<String>,
}

/// Gist creation/update request
#[derive(Debug, Clone, Serialize)]
pub struct GistRequest {
    pub description: String,
    pub public: bool,
    pub files: HashMap<String, GistFileContent>,
}

/// Gist file content for creation/update
#[derive(Debug, Clone, Serialize)]
pub struct GistFileContent {
    pub content: String,
}

/// Error types for Gist API operations
#[derive(Debug, thiserror::Error)]
pub enum GistApiError {
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
}

/// GitHub Gist API client
pub struct GistClient {
    access_token: String,
    client: reqwest::Client,
}

impl GistClient {
    /// Create a new Gist client
    pub fn new(access_token: String) -> Self {
        Self {
            access_token,
            client: reqwest::Client::new(),
        }
    }

    /// Get authenticated user info
    pub async fn get_user_info(&self) -> Result<GitHubUser, GistApiError> {
        let response = self.client
            .get(format!("{}/user", GITHUB_API_BASE))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "NekoTick")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if response.status() == 401 {
            return Err(GistApiError::Unauthorized);
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .json::<GitHubUser>()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// List user's gists
    pub async fn list_gists(&self) -> Result<Vec<Gist>, GistApiError> {
        let response = self.client
            .get(format!("{}/gists", GITHUB_API_BASE))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "NekoTick")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if response.status() == 401 {
            return Err(GistApiError::Unauthorized);
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .json::<Vec<Gist>>()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// Find existing NekoTick sync gist
    pub async fn find_nekotick_gist(&self) -> Result<Option<Gist>, GistApiError> {
        let gists = self.list_gists().await?;
        
        // Find gist with our description and data.json file
        Ok(gists.into_iter().find(|g| {
            g.description.as_deref() == Some(NEKOTICK_GIST_DESCRIPTION) 
                && g.files.contains_key(DATA_FILE_NAME)
        }))
    }

    /// Get a specific gist by ID
    pub async fn get_gist(&self, gist_id: &str) -> Result<Gist, GistApiError> {
        let response = self.client
            .get(format!("{}/gists/{}", GITHUB_API_BASE, gist_id))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "NekoTick")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if response.status() == 401 {
            return Err(GistApiError::Unauthorized);
        }

        if response.status() == 404 {
            return Err(GistApiError::NotFound(format!("Gist {} not found", gist_id)));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .json::<Gist>()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// Create a new private gist
    pub async fn create_gist(&self, content: &str) -> Result<Gist, GistApiError> {
        let mut files = HashMap::new();
        files.insert(
            DATA_FILE_NAME.to_string(),
            GistFileContent {
                content: content.to_string(),
            },
        );

        let request = GistRequest {
            description: NEKOTICK_GIST_DESCRIPTION.to_string(),
            public: false,
            files,
        };

        let response = self.client
            .post(format!("{}/gists", GITHUB_API_BASE))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "NekoTick")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&request)
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if response.status() == 401 {
            return Err(GistApiError::Unauthorized);
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .json::<Gist>()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// Update an existing gist
    pub async fn update_gist(&self, gist_id: &str, content: &str) -> Result<Gist, GistApiError> {
        let mut files = HashMap::new();
        files.insert(
            DATA_FILE_NAME.to_string(),
            GistFileContent {
                content: content.to_string(),
            },
        );

        let request = GistRequest {
            description: NEKOTICK_GIST_DESCRIPTION.to_string(),
            public: false,
            files,
        };

        let response = self.client
            .patch(format!("{}/gists/{}", GITHUB_API_BASE, gist_id))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "NekoTick")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&request)
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if response.status() == 401 {
            return Err(GistApiError::Unauthorized);
        }

        if response.status() == 404 {
            return Err(GistApiError::NotFound(format!("Gist {} not found", gist_id)));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .json::<Gist>()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// Download gist content (data.json)
    pub async fn download_data(&self, gist_id: &str) -> Result<String, GistApiError> {
        let gist = self.get_gist(gist_id).await?;
        
        let file = gist.files.get(DATA_FILE_NAME)
            .ok_or_else(|| GistApiError::NotFound("data.json not found in gist".to_string()))?;

        // If content is included in response, use it
        if let Some(content) = &file.content {
            return Ok(content.clone());
        }

        // Otherwise, fetch from raw_url
        let raw_url = file.raw_url.as_ref()
            .ok_or_else(|| GistApiError::NotFound("No raw_url for data.json".to_string()))?;

        let response = self.client
            .get(raw_url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("User-Agent", "NekoTick")
            .send()
            .await
            .map_err(|e| GistApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GistApiError::ApiError(error_text));
        }

        response
            .text()
            .await
            .map_err(|e| GistApiError::ParseError(e.to_string()))
    }

    /// Upload data to gist (create or update)
    pub async fn upload_data(&self, gist_id: Option<&str>, content: &str) -> Result<Gist, GistApiError> {
        match gist_id {
            Some(id) => self.update_gist(id, content).await,
            None => self.create_gist(content).await,
        }
    }
}
