//! Encrypted credential storage using AES-256-GCM
//!
//! OAuth tokens are encrypted with a key derived from the device ID,
//! ensuring credentials are bound to the specific device.

use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

use crate::credentials::CredentialError;

type HmacSha256 = Hmac<Sha256>;

const CREDENTIALS_FILE_NAME: &str = ".credentials.dat";
const CREDENTIALS_SALT: &str = "nekotick_credentials_v1";

/// Stored credential data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub device_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
    pub user_email: Option<String>,
    pub folder_id: Option<String>,
    pub signature: String,
}

impl StoredCredentials {
    /// Create new credentials with computed signature
    pub fn new(
        device_id: String,
        access_token: String,
        refresh_token: String,
        expires_at: i64,
        user_email: Option<String>,
        folder_id: Option<String>,
    ) -> Self {
        let mut creds = Self {
            device_id,
            access_token,
            refresh_token,
            expires_at,
            user_email,
            folder_id,
            signature: String::new(),
        };
        creds.signature = creds.compute_signature_internal();
        creds
    }

    /// Compute HMAC-SHA256 signature
    fn compute_signature_internal(&self) -> String {
        let message = format!(
            "{}:{}:{}:{}:{}:{}",
            self.access_token,
            self.refresh_token,
            self.expires_at,
            self.user_email.as_deref().unwrap_or(""),
            self.folder_id.as_deref().unwrap_or(""),
            CREDENTIALS_SALT
        );

        let mut mac: HmacSha256 = Mac::new_from_slice(self.device_id.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(message.as_bytes());
        let result = mac.finalize();

        hex::encode(result.into_bytes())
    }

    /// Verify signature is valid
    pub fn verify_signature(&self) -> bool {
        let expected = self.compute_signature_internal();
        constant_time_eq(self.signature.as_bytes(), expected.as_bytes())
    }

    /// Update access token and recompute signature
    pub fn update_access_token(&mut self, access_token: String, expires_at: i64) {
        self.access_token = access_token;
        self.expires_at = expires_at;
        self.signature = self.compute_signature_internal();
    }

    /// Update folder ID and recompute signature
    pub fn update_folder_id(&mut self, folder_id: String) {
        self.folder_id = Some(folder_id);
        self.signature = self.compute_signature_internal();
    }

    /// Check if token is about to expire (within 5 minutes)
    pub fn is_token_expiring(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        let five_minutes = 5 * 60;
        self.expires_at - now < five_minutes
    }
}

/// Constant-time comparison to prevent timing attacks
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}

/// Encrypted credential store
pub struct CredentialStore {
    file_path: PathBuf,
    device_id: String,
}

impl CredentialStore {
    pub fn new(app_data_dir: &PathBuf, device_id: String) -> Self {
        Self {
            file_path: app_data_dir.join(CREDENTIALS_FILE_NAME),
            device_id,
        }
    }

    /// Derive AES encryption key from device_id
    fn derive_encryption_key(&self) -> [u8; 32] {
        let key_material = format!("{}{}", self.device_id, CREDENTIALS_SALT);
        let mut hasher = Sha256::new();
        hasher.update(key_material.as_bytes());
        let hash = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash[..32]);
        key
    }

    /// Encrypt and save credentials to file
    pub fn save(&self, creds: &StoredCredentials) -> Result<(), CredentialError> {
        let json = serde_json::to_string(creds)?;
        let key = self.derive_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| CredentialError::StorageError(e.to_string()))?;

        // Generate random nonce
        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, json.as_bytes())
            .map_err(|e| CredentialError::StorageError(e.to_string()))?;

        // Write: nonce + ciphertext
        let mut output = Vec::with_capacity(12 + ciphertext.len());
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        // Ensure parent directory exists
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(&self.file_path, output)?;
        Ok(())
    }

    /// Decrypt and load credentials from file
    pub fn load(&self) -> Result<StoredCredentials, CredentialError> {
        if !self.file_path.exists() {
            return Err(CredentialError::NotFound);
        }

        let encrypted = std::fs::read(&self.file_path)?;
        if encrypted.len() < 12 {
            return Err(CredentialError::StorageError("Invalid file format".into()));
        }

        let key = self.derive_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| CredentialError::StorageError(e.to_string()))?;

        let nonce = Nonce::from_slice(&encrypted[..12]);
        let ciphertext = &encrypted[12..];

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| CredentialError::DecryptionFailed)?;

        let creds: StoredCredentials = serde_json::from_slice(&plaintext)?;

        // Verify device_id matches
        if creds.device_id != self.device_id {
            // Device ID mismatch - punishment mechanism triggered
            self.delete_corrupted()?;
            return Err(CredentialError::DeviceMismatch);
        }

        // Verify signature
        if !creds.verify_signature() {
            self.delete_corrupted()?;
            return Err(CredentialError::SignatureInvalid);
        }

        Ok(creds)
    }

    /// Delete credentials file
    pub fn delete(&self) -> Result<(), CredentialError> {
        if self.file_path.exists() {
            std::fs::remove_file(&self.file_path)?;
        }
        Ok(())
    }

    /// Delete corrupted credentials file (internal use)
    fn delete_corrupted(&self) -> Result<(), CredentialError> {
        if self.file_path.exists() {
            let _ = std::fs::remove_file(&self.file_path);
        }
        Ok(())
    }

    /// Check if credentials file exists
    pub fn exists(&self) -> bool {
        self.file_path.exists()
    }

    /// Get device ID
    pub fn get_device_id(&self) -> &str {
        &self.device_id
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_credentials(device_id: &str) -> StoredCredentials {
        StoredCredentials::new(
            device_id.to_string(),
            "test_access_token".to_string(),
            "test_refresh_token".to_string(),
            chrono::Utc::now().timestamp() + 3600,
            Some("test@example.com".to_string()),
            Some("folder_123".to_string()),
        )
    }

    #[test]
    fn test_signature_verification() {
        let creds = create_test_credentials("test_device");
        assert!(creds.verify_signature(), "Valid signature should verify");
    }

    #[test]
    fn test_tampered_access_token_fails() {
        let mut creds = create_test_credentials("test_device");
        creds.access_token = "tampered_token".to_string();
        assert!(!creds.verify_signature(), "Tampered access_token should fail");
    }

    #[test]
    fn test_tampered_refresh_token_fails() {
        let mut creds = create_test_credentials("test_device");
        creds.refresh_token = "tampered_refresh".to_string();
        assert!(!creds.verify_signature(), "Tampered refresh_token should fail");
    }

    #[test]
    fn test_store_round_trip() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let device_id = "test_device_12345";

        let store = CredentialStore::new(&path, device_id.to_string());
        let original = create_test_credentials(device_id);

        // Save
        store.save(&original).unwrap();
        assert!(store.exists(), "Credentials file should exist after save");

        // Load
        let loaded = store.load().unwrap();
        assert_eq!(original.access_token, loaded.access_token);
        assert_eq!(original.refresh_token, loaded.refresh_token);
        assert_eq!(original.user_email, loaded.user_email);
    }

    #[test]
    fn test_wrong_device_id_fails_load() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();

        // Save with device A
        let store_a = CredentialStore::new(&path, "device_a".to_string());
        let creds = create_test_credentials("device_a");
        store_a.save(&creds).unwrap();

        // Try to load with device B
        let store_b = CredentialStore::new(&path, "device_b".to_string());
        let result = store_b.load();

        // Should fail because decryption key is different
        assert!(result.is_err(), "Loading with wrong device_id should fail");
    }

    #[test]
    fn test_delete_credentials() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let device_id = "test_device";

        let store = CredentialStore::new(&path, device_id.to_string());
        let creds = create_test_credentials(device_id);

        store.save(&creds).unwrap();
        assert!(store.exists());

        store.delete().unwrap();
        assert!(!store.exists());
    }

    #[test]
    fn test_update_access_token() {
        let mut creds = create_test_credentials("test_device");
        let new_expires = chrono::Utc::now().timestamp() + 7200;
        
        creds.update_access_token("new_access_token".to_string(), new_expires);
        
        assert_eq!(creds.access_token, "new_access_token");
        assert_eq!(creds.expires_at, new_expires);
        assert!(creds.verify_signature(), "Signature should be valid after update");
    }

    #[test]
    fn test_update_folder_id() {
        let mut creds = create_test_credentials("test_device");
        
        creds.update_folder_id("new_folder_id".to_string());
        
        assert_eq!(creds.folder_id, Some("new_folder_id".to_string()));
        assert!(creds.verify_signature(), "Signature should be valid after update");
    }

    #[test]
    fn test_token_expiring() {
        let now = chrono::Utc::now().timestamp();
        
        // Token expiring in 3 minutes - should be expiring
        let expiring = StoredCredentials::new(
            "device".to_string(),
            "access".to_string(),
            "refresh".to_string(),
            now + 3 * 60,
            None,
            None,
        );
        assert!(expiring.is_token_expiring());

        // Token expiring in 10 minutes - should not be expiring
        let valid = StoredCredentials::new(
            "device".to_string(),
            "access".to_string(),
            "refresh".to_string(),
            now + 10 * 60,
            None,
            None,
        );
        assert!(!valid.is_token_expiring());
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    use tempfile::tempdir;

    // Generate random device IDs
    fn device_id_strategy() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9]{16,64}".prop_map(|s| s)
    }

    // Generate random tokens
    fn token_strategy() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9]{32,128}".prop_map(|s| s)
    }

    // Generate random timestamps
    fn timestamp_strategy() -> impl Strategy<Value = i64> {
        1577836800i64..1893456000i64
    }

    // Generate optional email
    fn email_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            "[a-z]{5,10}@[a-z]{5,10}\\.[a-z]{2,3}".prop_map(Some)
        ]
    }

    proptest! {
        /// Property 4: Encryption key derivation determinism
        /// Same device_id should always produce same encryption key
        #[test]
        fn test_key_derivation_determinism(device_id in device_id_strategy()) {
            let temp_dir = tempdir().unwrap();
            let path = temp_dir.path().to_path_buf();
            
            let store1 = CredentialStore::new(&path, device_id.clone());
            let store2 = CredentialStore::new(&path, device_id.clone());

            // Create and save with store1
            let creds = StoredCredentials::new(
                device_id.clone(),
                "access".to_string(),
                "refresh".to_string(),
                chrono::Utc::now().timestamp() + 3600,
                None,
                None,
            );
            store1.save(&creds).unwrap();

            // Load with store2 (same device_id)
            let loaded = store2.load();
            prop_assert!(loaded.is_ok(), "Same device_id should decrypt successfully");
        }

        /// Property 5: Encryption/decryption round-trip consistency
        #[test]
        fn test_encryption_round_trip(
            device_id in device_id_strategy(),
            access_token in token_strategy(),
            refresh_token in token_strategy(),
            expires_at in timestamp_strategy(),
            user_email in email_strategy()
        ) {
            let temp_dir = tempdir().unwrap();
            let path = temp_dir.path().to_path_buf();
            let store = CredentialStore::new(&path, device_id.clone());

            let original = StoredCredentials::new(
                device_id,
                access_token.clone(),
                refresh_token.clone(),
                expires_at,
                user_email.clone(),
                None,
            );

            store.save(&original).unwrap();
            let loaded = store.load().unwrap();

            prop_assert_eq!(&original.access_token, &loaded.access_token);
            prop_assert_eq!(&original.refresh_token, &loaded.refresh_token);
            prop_assert_eq!(original.expires_at, loaded.expires_at);
            prop_assert_eq!(&original.user_email, &loaded.user_email);
            prop_assert!(loaded.verify_signature());
        }

        /// Property 6: Device binding enforcement
        #[test]
        fn test_device_binding_enforcement(
            device_id_a in device_id_strategy(),
            device_id_b in device_id_strategy()
        ) {
            prop_assume!(device_id_a != device_id_b);

            let temp_dir = tempdir().unwrap();
            let path = temp_dir.path().to_path_buf();

            // Save with device A
            let store_a = CredentialStore::new(&path, device_id_a.clone());
            let creds = StoredCredentials::new(
                device_id_a,
                "access".to_string(),
                "refresh".to_string(),
                chrono::Utc::now().timestamp() + 3600,
                None,
                None,
            );
            store_a.save(&creds).unwrap();

            // Try to load with device B
            let store_b = CredentialStore::new(&path, device_id_b);
            let result = store_b.load();

            prop_assert!(result.is_err(), "Different device_id should fail to decrypt");
        }

        /// Property: HMAC signature integrity
        #[test]
        fn test_signature_integrity(device_id in device_id_strategy()) {
            let mut creds = StoredCredentials::new(
                device_id,
                "access".to_string(),
                "refresh".to_string(),
                chrono::Utc::now().timestamp() + 3600,
                None,
                None,
            );
            prop_assert!(creds.verify_signature(), "Original should verify");

            // Tamper with access_token
            let original_token = creds.access_token.clone();
            creds.access_token = "tampered".to_string();
            prop_assert!(!creds.verify_signature(), "Tampered access_token should fail");
            creds.access_token = original_token;

            // Tamper with expires_at
            creds.expires_at += 1;
            prop_assert!(!creds.verify_signature(), "Tampered expires_at should fail");
        }
    }
}
