use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

use crate::license::LicenseError;

type HmacSha256 = Hmac<Sha256>;

const LICENSE_FILE_NAME: &str = ".license.dat";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LicenseData {
    pub license_key: String,
    pub device_id: String,
    pub activated_at: i64,
    pub last_validated_at: i64,
    pub last_seen_system_time: i64,
    pub signature: String,
}

impl LicenseData {
    /// Create new LicenseData with computed signature
    pub fn new(
        license_key: String,
        device_id: String,
        activated_at: i64,
        last_validated_at: i64,
    ) -> Self {
        let last_seen_system_time = chrono::Utc::now().timestamp();
        let signature = Self::compute_signature(
            &device_id,
            &license_key,
            activated_at,
            last_validated_at,
            last_seen_system_time,
        );

        Self {
            license_key,
            device_id,
            activated_at,
            last_validated_at,
            last_seen_system_time,
            signature,
        }
    }

    /// Compute HMAC-SHA256 signature
    pub fn compute_signature(
        device_id: &str,
        license_key: &str,
        activated_at: i64,
        last_validated_at: i64,
        last_seen_system_time: i64,
    ) -> String {
        let message = format!(
            "{}:{}:{}:{}",
            license_key, activated_at, last_validated_at, last_seen_system_time
        );

        let mut mac: HmacSha256 = Mac::new_from_slice(device_id.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(message.as_bytes());
        let result = mac.finalize();

        hex::encode(result.into_bytes())
    }

    /// Verify signature is valid
    pub fn verify_signature(&self) -> bool {
        let expected = Self::compute_signature(
            &self.device_id,
            &self.license_key,
            self.activated_at,
            self.last_validated_at,
            self.last_seen_system_time,
        );

        // Constant-time comparison to prevent timing attacks
        constant_time_eq(self.signature.as_bytes(), expected.as_bytes())
    }

    /// Update last_validated_at and recompute signature
    pub fn update_validation_time(&mut self, timestamp: i64) {
        self.last_validated_at = timestamp;
        self.update_seen_time_and_signature();
    }

    /// Update last_seen_system_time and recompute signature
    pub fn update_seen_time_and_signature(&mut self) {
        self.last_seen_system_time = chrono::Utc::now().timestamp();
        self.signature = Self::compute_signature(
            &self.device_id,
            &self.license_key,
            self.activated_at,
            self.last_validated_at,
            self.last_seen_system_time,
        );
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

pub struct LicenseStore {
    file_path: PathBuf,
    device_id: String,
}

impl LicenseStore {
    pub fn new(app_data_dir: &PathBuf, device_id: String) -> Self {
        Self {
            file_path: app_data_dir.join(LICENSE_FILE_NAME),
            device_id,
        }
    }

    /// Derive AES encryption key from device_id
    fn derive_encryption_key(&self) -> [u8; 32] {
        let key_material = format!("{}nekotick_license_v1", self.device_id);
        let mut hasher = Sha256::new();
        hasher.update(key_material.as_bytes());
        let hash = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash[..32]);
        key
    }

    /// Encrypt and save to file
    pub fn save(&self, data: &LicenseData) -> Result<(), LicenseError> {
        let json = serde_json::to_string(data)?;
        let key = self.derive_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| LicenseError::CryptoError(e.to_string()))?;

        // Generate random nonce
        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, json.as_bytes())
            .map_err(|e| LicenseError::CryptoError(e.to_string()))?;

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

    /// Decrypt and load from file
    pub fn load(&self) -> Result<LicenseData, LicenseError> {
        if !self.file_path.exists() {
            return Err(LicenseError::NotFound);
        }

        let encrypted = std::fs::read(&self.file_path)?;
        if encrypted.len() < 12 {
            return Err(LicenseError::StorageError("Invalid file format".into()));
        }

        let key = self.derive_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| LicenseError::CryptoError(e.to_string()))?;

        let nonce = Nonce::from_slice(&encrypted[..12]);
        let ciphertext = &encrypted[12..];

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| LicenseError::CryptoError("Decryption failed".into()))?;

        let data: LicenseData = serde_json::from_slice(&plaintext)?;

        // Verify signature
        if !data.verify_signature() {
            return Err(LicenseError::SignatureInvalid);
        }

        // Verify device_id matches
        if data.device_id != self.device_id {
            return Err(LicenseError::SignatureInvalid);
        }

        Ok(data)
    }

    /// Delete license file
    pub fn delete(&self) -> Result<(), LicenseError> {
        if self.file_path.exists() {
            std::fs::remove_file(&self.file_path)?;
        }
        Ok(())
    }

    /// Check if license file exists
    pub fn exists(&self) -> bool {
        self.file_path.exists()
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_license_data(device_id: &str) -> LicenseData {
        LicenseData::new(
            "NEKO-TEST-1234-5678".to_string(),
            device_id.to_string(),
            1703001600,
            1703001600,
        )
    }

    #[test]
    fn test_signature_verification() {
        let data = create_test_license_data("test_device_id");
        assert!(data.verify_signature(), "Valid signature should verify");
    }

    #[test]
    fn test_tampered_license_key_fails() {
        let mut data = create_test_license_data("test_device_id");
        data.license_key = "NEKO-FAKE-0000-0000".to_string();
        assert!(!data.verify_signature(), "Tampered license_key should fail");
    }

    #[test]
    fn test_tampered_activated_at_fails() {
        let mut data = create_test_license_data("test_device_id");
        data.activated_at = 9999999999;
        assert!(!data.verify_signature(), "Tampered activated_at should fail");
    }

    #[test]
    fn test_tampered_device_id_fails() {
        let mut data = create_test_license_data("test_device_id");
        data.device_id = "other_device".to_string();
        assert!(!data.verify_signature(), "Tampered device_id should fail");
    }

    #[test]
    fn test_store_round_trip() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let device_id = "test_device_12345";

        let store = LicenseStore::new(&path, device_id.to_string());
        let original = create_test_license_data(device_id);

        // Save
        store.save(&original).unwrap();
        assert!(store.exists(), "License file should exist after save");

        // Load
        let loaded = store.load().unwrap();
        assert_eq!(original.license_key, loaded.license_key);
        assert_eq!(original.device_id, loaded.device_id);
        assert_eq!(original.activated_at, loaded.activated_at);
    }

    #[test]
    fn test_wrong_device_id_fails_load() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();

        // Save with device A
        let store_a = LicenseStore::new(&path, "device_a".to_string());
        let data = create_test_license_data("device_a");
        store_a.save(&data).unwrap();

        // Try to load with device B (simulates copying file to another device)
        let store_b = LicenseStore::new(&path, "device_b".to_string());
        let result = store_b.load();
        
        // Should fail because decryption key is different
        assert!(result.is_err(), "Loading with wrong device_id should fail");
    }

    #[test]
    fn test_delete_license() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let device_id = "test_device";

        let store = LicenseStore::new(&path, device_id.to_string());
        let data = create_test_license_data(device_id);

        store.save(&data).unwrap();
        assert!(store.exists());

        store.delete().unwrap();
        assert!(!store.exists());
    }
}
