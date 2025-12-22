//! Secure token storage using system keyring
//!
//! Stores OAuth tokens securely using the operating system's
//! credential storage (Windows Credential Manager, macOS Keychain, etc.)

use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "nekotick";
const ACCOUNT_NAME: &str = "google_oauth";

/// Stored token data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
    pub user_email: Option<String>,
    pub folder_id: Option<String>,
}

/// Error types for token storage operations
#[derive(Debug, thiserror::Error)]
pub enum KeyringError {
    #[error("Keyring error: {0}")]
    KeyringError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Token not found")]
    NotFound,
}

/// Token manager for secure credential storage
pub struct TokenManager;

impl TokenManager {
    /// Store tokens in the system keyring
    pub fn store_tokens(tokens: &StoredTokens) -> Result<(), KeyringError> {
        let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
            .map_err(|e| KeyringError::KeyringError(e.to_string()))?;

        let json = serde_json::to_string(tokens)
            .map_err(|e| KeyringError::SerializationError(e.to_string()))?;

        entry
            .set_password(&json)
            .map_err(|e| KeyringError::KeyringError(e.to_string()))?;

        Ok(())
    }

    /// Retrieve tokens from the system keyring
    pub fn get_tokens() -> Result<Option<StoredTokens>, KeyringError> {
        let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
            .map_err(|e| KeyringError::KeyringError(e.to_string()))?;

        match entry.get_password() {
            Ok(json) => {
                let tokens: StoredTokens = serde_json::from_str(&json)
                    .map_err(|e| KeyringError::SerializationError(e.to_string()))?;
                Ok(Some(tokens))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(KeyringError::KeyringError(e.to_string())),
        }
    }

    /// Delete all tokens from the system keyring
    pub fn clear_tokens() -> Result<(), KeyringError> {
        let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
            .map_err(|e| KeyringError::KeyringError(e.to_string()))?;

        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(KeyringError::KeyringError(e.to_string())),
        }
    }

    /// Check if token is about to expire (within 5 minutes)
    pub fn is_token_expiring(tokens: &StoredTokens) -> bool {
        let now = chrono::Utc::now().timestamp();
        let five_minutes = 5 * 60;
        tokens.expires_at - now < five_minutes
    }

    /// Update only the access token and expiry
    pub fn update_access_token(
        access_token: &str,
        expires_in: u64,
    ) -> Result<(), KeyringError> {
        let mut tokens = Self::get_tokens()?.ok_or(KeyringError::NotFound)?;
        
        tokens.access_token = access_token.to_string();
        tokens.expires_at = chrono::Utc::now().timestamp() + expires_in as i64;
        
        Self::store_tokens(&tokens)
    }

    /// Update the folder ID
    pub fn update_folder_id(folder_id: &str) -> Result<(), KeyringError> {
        let mut tokens = Self::get_tokens()?.ok_or(KeyringError::NotFound)?;
        tokens.folder_id = Some(folder_id.to_string());
        Self::store_tokens(&tokens)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_expiry_check() {
        let now = chrono::Utc::now().timestamp();
        
        // Token expiring in 3 minutes - should be expiring
        let expiring_tokens = StoredTokens {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: now + 3 * 60,
            user_email: None,
            folder_id: None,
        };
        assert!(TokenManager::is_token_expiring(&expiring_tokens));

        // Token expiring in 10 minutes - should not be expiring
        let valid_tokens = StoredTokens {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: now + 10 * 60,
            user_email: None,
            folder_id: None,
        };
        assert!(!TokenManager::is_token_expiring(&valid_tokens));
    }
}
