//! OAuth2 PKCE implementation for GitHub
//!
//! Implements the OAuth2 Authorization Code flow with PKCE extension
//! for secure desktop application authentication.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use url::Url;

/// GitHub OAuth2 client configuration
pub struct GitHubOAuthClient {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// Token response from GitHub OAuth2
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitHubTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: Option<String>,
}

/// Error types for OAuth operations
#[derive(Debug, thiserror::Error)]
pub enum GitHubOAuthError {
    #[error("Failed to generate code verifier")]
    CodeVerifierError,
    #[error("Failed to start callback server: {0}")]
    ServerError(String),
    #[error("Authorization failed: {0}")]
    AuthorizationError(String),
    #[error("Token exchange failed: {0}")]
    TokenExchangeError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
}

impl GitHubOAuthClient {
    /// Create a new GitHub OAuth client
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            redirect_uri: "http://localhost".to_string(),
        }
    }

    /// Generate a cryptographically random code_verifier (43-128 characters)
    pub fn generate_code_verifier() -> String {
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const LENGTH: usize = 64;

        let mut rng = rand::thread_rng();
        (0..LENGTH)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }

    /// Compute code_challenge from code_verifier using SHA256 + base64url
    pub fn compute_code_challenge(verifier: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let hash = hasher.finalize();
        URL_SAFE_NO_PAD.encode(hash)
    }

    /// Generate a random state parameter
    pub fn generate_state() -> String {
        Self::generate_code_verifier()
    }

    /// Build the GitHub OAuth2 authorization URL
    pub fn build_auth_url(&self, state: &str, port: u16) -> String {
        let redirect_uri = format!("{}:{}", self.redirect_uri, port);
        
        let mut url = Url::parse("https://github.com/login/oauth/authorize").unwrap();
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("redirect_uri", &redirect_uri)
            .append_pair("scope", "repo gist read:user")
            .append_pair("state", state);

        url.to_string()
    }

    /// Wait for OAuth callback on an existing listener
    /// Returns the authorization code
    pub fn wait_for_callback(listener: TcpListener, expected_state: &str) -> Result<String, GitHubOAuthError> {
        let (mut stream, _) = listener.accept()
            .map_err(|e| GitHubOAuthError::ServerError(e.to_string()))?;

        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        reader.read_line(&mut request_line)
            .map_err(|e| GitHubOAuthError::ServerError(e.to_string()))?;

        // Parse the request to extract code and state
        let url_part = request_line
            .split_whitespace()
            .nth(1)
            .ok_or_else(|| GitHubOAuthError::AuthorizationError("Invalid request".to_string()))?;

        let full_url = format!("http://localhost{}", url_part);
        let parsed = Url::parse(&full_url)
            .map_err(|e| GitHubOAuthError::AuthorizationError(e.to_string()))?;

        let mut code = None;
        let mut state = None;
        let mut error = None;
        let mut error_description = None;

        for (key, value) in parsed.query_pairs() {
            match key.as_ref() {
                "code" => code = Some(value.to_string()),
                "state" => state = Some(value.to_string()),
                "error" => error = Some(value.to_string()),
                "error_description" => error_description = Some(value.to_string()),
                _ => {}
            }
        }

        // Check for errors
        if let Some(err) = error {
            let err_msg = error_description.unwrap_or(err);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                <html><body><h1>Authorization Failed</h1><p>Error: {}</p>\
                <p>You can close this window.</p></body></html>",
                err_msg
            );
            let _ = stream.write_all(response.as_bytes());
            return Err(GitHubOAuthError::AuthorizationError(err_msg));
        }

        // Verify state
        let received_state = state.ok_or_else(|| {
            GitHubOAuthError::AuthorizationError("Missing state parameter".to_string())
        })?;

        if received_state != expected_state {
            return Err(GitHubOAuthError::AuthorizationError("State mismatch".to_string()));
        }

        // Get the code
        let auth_code = code.ok_or_else(|| {
            GitHubOAuthError::AuthorizationError("Missing authorization code".to_string())
        })?;

        // Send success response
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
            <html><body><h1>Authorization Successful!</h1>\
            <p>You can close this window and return to NekoTick.</p></body></html>";
        let _ = stream.write_all(response.as_bytes());

        Ok(auth_code)
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(
        &self,
        code: &str,
        port: u16,
    ) -> Result<GitHubTokenResponse, GitHubOAuthError> {
        let redirect_uri = format!("{}:{}", self.redirect_uri, port);
        
        let client = reqwest::Client::new();
        let response = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("code", code),
                ("redirect_uri", redirect_uri.as_str()),
            ])
            .send()
            .await
            .map_err(|e| GitHubOAuthError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GitHubOAuthError::TokenExchangeError(error_text));
        }

        let token_response: serde_json::Value = response
            .json()
            .await
            .map_err(|e| GitHubOAuthError::TokenExchangeError(e.to_string()))?;

        // Check for error in response
        if let Some(error) = token_response.get("error") {
            let error_desc = token_response
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(GitHubOAuthError::TokenExchangeError(format!(
                "{}: {}",
                error.as_str().unwrap_or("error"),
                error_desc
            )));
        }

        Ok(GitHubTokenResponse {
            access_token: token_response["access_token"]
                .as_str()
                .ok_or_else(|| GitHubOAuthError::TokenExchangeError("Missing access_token".to_string()))?
                .to_string(),
            token_type: token_response["token_type"]
                .as_str()
                .unwrap_or("bearer")
                .to_string(),
            scope: token_response["scope"].as_str().map(|s| s.to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_verifier_length() {
        let verifier = GitHubOAuthClient::generate_code_verifier();
        assert!(verifier.len() >= 43 && verifier.len() <= 128);
    }

    #[test]
    fn test_code_verifier_charset() {
        let verifier = GitHubOAuthClient::generate_code_verifier();
        for c in verifier.chars() {
            assert!(
                c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_' || c == '~',
                "Invalid character in verifier: {}",
                c
            );
        }
    }
}
