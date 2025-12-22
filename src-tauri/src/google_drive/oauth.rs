//! OAuth2 PKCE implementation for Google Drive
//!
//! Implements the OAuth2 Authorization Code flow with PKCE extension
//! for secure desktop application authentication.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use url::Url;

/// OAuth2 client configuration
pub struct OAuthClient {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// Token response from Google OAuth2
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
    pub scope: Option<String>,
}

/// Error types for OAuth operations
#[derive(Debug, thiserror::Error)]
pub enum OAuthError {
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

impl OAuthClient {
    /// Create a new OAuth client
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            redirect_uri: "http://localhost".to_string(),
        }
    }

    /// Generate a cryptographically random code_verifier (43-128 characters)
    /// Uses URL-safe characters: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
    pub fn generate_code_verifier() -> String {
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const LENGTH: usize = 64; // Within 43-128 range

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

    /// Build the Google OAuth2 authorization URL
    pub fn build_auth_url(&self, code_challenge: &str, state: &str, port: u16) -> String {
        let redirect_uri = format!("{}:{}", self.redirect_uri, port);
        
        let mut url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("redirect_uri", &redirect_uri)
            .append_pair("response_type", "code")
            .append_pair("scope", "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email")
            .append_pair("code_challenge", code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", state)
            .append_pair("access_type", "offline")
            .append_pair("prompt", "consent");

        url.to_string()
    }

    /// Start a local HTTP server to receive the OAuth callback
    /// Returns the authorization code and the port used
    pub fn start_callback_server(&self, expected_state: &str) -> Result<(String, u16), OAuthError> {
        // Try to bind to an available port
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| OAuthError::ServerError(e.to_string()))?;
        
        let port = listener.local_addr()
            .map_err(|e| OAuthError::ServerError(e.to_string()))?
            .port();

        let code = Self::wait_for_callback(listener, expected_state)?;
        Ok((code, port))
    }

    /// Wait for OAuth callback on an existing listener
    /// Returns the authorization code
    pub fn wait_for_callback(listener: TcpListener, expected_state: &str) -> Result<String, OAuthError> {
        // Wait for the callback (with timeout handled by caller)
        let (mut stream, _) = listener.accept()
            .map_err(|e| OAuthError::ServerError(e.to_string()))?;

        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        reader.read_line(&mut request_line)
            .map_err(|e| OAuthError::ServerError(e.to_string()))?;

        // Parse the request to extract code and state
        let url_part = request_line
            .split_whitespace()
            .nth(1)
            .ok_or_else(|| OAuthError::AuthorizationError("Invalid request".to_string()))?;

        let full_url = format!("http://localhost{}", url_part);
        let parsed = Url::parse(&full_url)
            .map_err(|e| OAuthError::AuthorizationError(e.to_string()))?;

        let mut code = None;
        let mut state = None;
        let mut error = None;

        for (key, value) in parsed.query_pairs() {
            match key.as_ref() {
                "code" => code = Some(value.to_string()),
                "state" => state = Some(value.to_string()),
                "error" => error = Some(value.to_string()),
                _ => {}
            }
        }

        // Check for errors
        if let Some(err) = error {
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                <html><body><h1>Authorization Failed</h1><p>Error: {}</p>\
                <p>You can close this window.</p></body></html>",
                err
            );
            let _ = stream.write_all(response.as_bytes());
            return Err(OAuthError::AuthorizationError(err));
        }

        // Verify state
        let received_state = state.ok_or_else(|| {
            OAuthError::AuthorizationError("Missing state parameter".to_string())
        })?;

        if received_state != expected_state {
            return Err(OAuthError::AuthorizationError("State mismatch".to_string()));
        }

        // Get the code
        let auth_code = code.ok_or_else(|| {
            OAuthError::AuthorizationError("Missing authorization code".to_string())
        })?;

        // Send success response
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
            <html><body><h1>Authorization Successful!</h1>\
            <p>You can close this window and return to NekoTick.</p></body></html>";
        let _ = stream.write_all(response.as_bytes());

        Ok(auth_code)
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(
        &self,
        code: &str,
        verifier: &str,
        port: u16,
    ) -> Result<TokenResponse, OAuthError> {
        let redirect_uri = format!("{}:{}", self.redirect_uri, port);
        
        let client = reqwest::Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("code", code),
                ("code_verifier", verifier),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri.as_str()),
            ])
            .send()
            .await
            .map_err(|e| OAuthError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(OAuthError::TokenExchangeError(error_text));
        }

        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| OAuthError::TokenExchangeError(e.to_string()))
    }

    /// Refresh access token using refresh token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TokenResponse, OAuthError> {
        let client = reqwest::Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| OAuthError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(OAuthError::TokenExchangeError(error_text));
        }

        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| OAuthError::TokenExchangeError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_verifier_length() {
        let verifier = OAuthClient::generate_code_verifier();
        assert!(verifier.len() >= 43 && verifier.len() <= 128);
    }

    #[test]
    fn test_code_verifier_charset() {
        let verifier = OAuthClient::generate_code_verifier();
        for c in verifier.chars() {
            assert!(
                c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_' || c == '~',
                "Invalid character in verifier: {}",
                c
            );
        }
    }

    #[test]
    fn test_code_challenge_computation() {
        // Known test vector
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = OAuthClient::compute_code_challenge(verifier);
        // SHA256 of the verifier, base64url encoded
        assert!(!challenge.is_empty());
        assert!(!challenge.contains('+'));
        assert!(!challenge.contains('/'));
        assert!(!challenge.contains('='));
    }
}
