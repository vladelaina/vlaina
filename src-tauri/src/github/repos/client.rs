use serde::de::DeserializeOwned;

use super::error::RepoApiError;

pub(crate) const GITHUB_API_BASE: &str = "https://api.github.com";

pub struct RepoClient {
    access_token: String,
    pub(crate) client: reqwest::Client,
}

impl RepoClient {
    pub fn new(access_token: String) -> Self {
        Self {
            access_token,
            client: reqwest::Client::new(),
        }
    }

    pub(crate) fn build_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "Authorization",
            format!("Bearer {}", self.access_token).parse().unwrap(),
        );
        headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
        headers.insert("User-Agent", "NekoTick".parse().unwrap());
        headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
        headers
    }

    pub(crate) async fn parse_json<T: DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<T, RepoApiError> {
        response
            .json::<T>()
            .await
            .map_err(|error| RepoApiError::ParseError(error.to_string()))
    }

    pub(crate) async fn handle_error(&self, response: reqwest::Response) -> RepoApiError {
        let status = response.status();

        if status == 401 {
            return RepoApiError::Unauthorized;
        }

        if status == 403 {
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
}
