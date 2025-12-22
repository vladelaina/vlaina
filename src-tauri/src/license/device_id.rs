use std::path::PathBuf;
use sha2::{Sha256, Digest};
use uuid::Uuid;

use crate::license::LicenseError;

pub struct DeviceIdGenerator;

impl DeviceIdGenerator {
    /// Generate device fingerprint (prefer hardware ID, fallback to persistent UUID)
    pub fn generate(app_data_dir: &PathBuf) -> Result<String, LicenseError> {
        // 1. Try to get hardware Machine ID
        match machine_uid::get() {
            Ok(raw_id) => {
                // SHA-256 hash for privacy
                let mut hasher = Sha256::new();
                hasher.update(raw_id.as_bytes());
                let hash = hasher.finalize();
                Ok(hex::encode(hash))
            }
            Err(_) => {
                // 2. Fallback: use persistent UUID
                Self::get_or_create_fallback_id(app_data_dir)
            }
        }
    }

    /// Fallback: read from file or generate new UUID
    fn get_or_create_fallback_id(app_data_dir: &PathBuf) -> Result<String, LicenseError> {
        let uuid_path = app_data_dir.join(".device_uuid");

        // Try to read existing UUID
        if uuid_path.exists() {
            let uuid = std::fs::read_to_string(&uuid_path)
                .map_err(|e| LicenseError::DeviceIdError(e.to_string()))?;
            return Ok(uuid.trim().to_string());
        }

        // Generate new UUID v4
        let new_uuid = Uuid::new_v4().to_string();

        // Ensure directory exists
        std::fs::create_dir_all(app_data_dir)
            .map_err(|e| LicenseError::DeviceIdError(e.to_string()))?;

        // Write to file
        std::fs::write(&uuid_path, &new_uuid)
            .map_err(|e| LicenseError::DeviceIdError(e.to_string()))?;

        Ok(new_uuid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_device_id_consistency() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();

        let id1 = DeviceIdGenerator::generate(&path).unwrap();
        let id2 = DeviceIdGenerator::generate(&path).unwrap();

        assert_eq!(id1, id2, "Device ID should be consistent across calls");
    }

    #[test]
    fn test_fallback_uuid_persistence() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let uuid_path = path.join(".device_uuid");

        // First call creates the file
        let id1 = DeviceIdGenerator::get_or_create_fallback_id(&path).unwrap();
        assert!(uuid_path.exists(), "UUID file should be created");

        // Second call reads from file
        let id2 = DeviceIdGenerator::get_or_create_fallback_id(&path).unwrap();
        assert_eq!(id1, id2, "Fallback UUID should be persistent");
    }

    #[test]
    fn test_device_id_format() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();

        let id = DeviceIdGenerator::generate(&path).unwrap();
        
        // Should be either a SHA-256 hash (64 hex chars) or UUID (36 chars with dashes)
        assert!(
            id.len() == 64 || id.len() == 36,
            "Device ID should be SHA-256 hash or UUID format"
        );
    }
}
