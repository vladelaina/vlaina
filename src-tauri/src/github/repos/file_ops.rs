use base64::{engine::general_purpose::STANDARD, Engine};

use crate::github::types::FileContent;

use super::api_types::ContentsResponse;
use super::client::{RepoClient, GITHUB_API_BASE};
use super::error::RepoApiError;

impl RepoClient {
    pub async fn get_file_content(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<FileContent, RepoApiError> {
        let response = self
            .client
            .get(format!("{}/repos/{}/{}/contents/{}", GITHUB_API_BASE, owner, repo, path))
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|error| RepoApiError::NetworkError(error.to_string()))?;

        if !response.status().is_success() {
            return Err(self.handle_error(response).await);
        }

        let content_response: ContentsResponse = self.parse_json(response).await?;
        let raw_content = content_response.content.unwrap_or_default();
        let cleaned_content = raw_content.replace('\n', "").replace('\r', "");
        let decoded_content = STANDARD
            .decode(&cleaned_content)
            .map_err(|error| RepoApiError::ParseError(format!("Base64 decode error: {}", error)))?;
        let content = String::from_utf8(decoded_content)
            .map_err(|error| RepoApiError::ParseError(format!("UTF-8 decode error: {}", error)))?;

        Ok(FileContent {
            path: content_response.path,
            content,
            sha: content_response.sha,
            encoding: content_response.encoding.unwrap_or_else(|| "base64".to_string()),
        })
    }
}
