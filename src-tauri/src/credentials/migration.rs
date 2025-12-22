//! Migration from Keyring to encrypted file storage
//!
//! This module handles the one-time migration of OAuth tokens from the
//! system keyring to the new encrypted file storage.

use crate::credentials::{CredentialStore, StoredCredentials};
use crate::google_drive::keyring_store::TokenManager;

/// Migration result
#[derive(Debug)]
pub enum MigrationResult {
    /// Migration completed successfully
    Migrated,
    /// No migration needed (already migrated or no old credentials)
    NotNeeded,
    /// Migration failed but old credentials preserved
    Failed(String),
}

/// Check if migration is needed and perform it if necessary
pub fn migrate_from_keyring(store: &CredentialStore) -> MigrationResult {
    // Check if new encrypted file already exists
    if store.exists() {
        return MigrationResult::NotNeeded;
    }

    // Try to read from keyring
    let old_tokens = match TokenManager::get_tokens() {
        Ok(Some(tokens)) => tokens,
        Ok(None) => return MigrationResult::NotNeeded,
        Err(e) => {
            println!("[Migration] Failed to read from keyring: {}", e);
            return MigrationResult::NotNeeded;
        }
    };

    // Create new encrypted credentials
    let new_creds = StoredCredentials::new(
        store.get_device_id().to_string(),
        old_tokens.access_token,
        old_tokens.refresh_token,
        old_tokens.expires_at,
        old_tokens.user_email,
        old_tokens.folder_id,
    );

    // Save to encrypted file
    if let Err(e) = store.save(&new_creds) {
        println!("[Migration] Failed to save encrypted credentials: {}", e);
        return MigrationResult::Failed(e.to_string());
    }

    // Clear old keyring entry only after successful migration
    if let Err(e) = TokenManager::clear_tokens() {
        println!("[Migration] Warning: Failed to clear old keyring entry: {}", e);
        // Don't fail the migration, just log the warning
    }

    println!("[Migration] Successfully migrated credentials from keyring to encrypted storage");
    MigrationResult::Migrated
}

/// Check if migration is needed without performing it
pub fn needs_migration(store: &CredentialStore) -> bool {
    if store.exists() {
        return false;
    }

    match TokenManager::get_tokens() {
        Ok(Some(_)) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_migration_not_needed_when_file_exists() {
        let temp_dir = tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let device_id = "test_device";

        let store = CredentialStore::new(&path, device_id.to_string());
        
        // Create existing credentials
        let creds = StoredCredentials::new(
            device_id.to_string(),
            "access".to_string(),
            "refresh".to_string(),
            chrono::Utc::now().timestamp() + 3600,
            None,
            None,
        );
        store.save(&creds).unwrap();

        // Migration should not be needed
        assert!(!needs_migration(&store));
        
        let result = migrate_from_keyring(&store);
        assert!(matches!(result, MigrationResult::NotNeeded));
    }

    // Note: We can't reliably test "no keyring data" scenario in unit tests
    // because the system keyring may have real data. Integration tests should
    // cover the full migration flow.
}
