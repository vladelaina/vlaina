//! Tauri commands for credential management

use tauri::Manager;
use crate::credentials::{CredentialError, CredentialStore, StoredCredentials};
use crate::credentials::migration::{migrate_from_keyring, MigrationResult};
use crate::license::device_id::DeviceIdGenerator;

/// Get stored credentials (decrypted)
#[tauri::command]
pub async fn get_credentials(app: tauri::AppHandle) -> Result<Option<StoredCredentials>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    match store.load() {
        Ok(creds) => Ok(Some(creds)),
        Err(CredentialError::NotFound) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Store credentials (encrypted)
#[tauri::command]
pub async fn store_credentials(
    app: tauri::AppHandle,
    access_token: String,
    refresh_token: String,
    expires_at: i64,
    user_email: Option<String>,
    folder_id: Option<String>,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id.clone());

    let creds = StoredCredentials::new(
        device_id,
        access_token,
        refresh_token,
        expires_at,
        user_email,
        folder_id,
    );

    store.save(&creds).map_err(|e| e.to_string())
}

/// Update access token only
#[tauri::command]
pub async fn update_credential_access_token(
    app: tauri::AppHandle,
    access_token: String,
    expires_at: i64,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    let mut creds = store.load().map_err(|e| e.to_string())?;
    creds.update_access_token(access_token, expires_at);
    store.save(&creds).map_err(|e| e.to_string())
}

/// Update folder ID only
#[tauri::command]
pub async fn update_credential_folder_id(
    app: tauri::AppHandle,
    folder_id: String,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    let mut creds = store.load().map_err(|e| e.to_string())?;
    creds.update_folder_id(folder_id);
    store.save(&creds).map_err(|e| e.to_string())
}

/// Clear all credentials
#[tauri::command]
pub async fn clear_credentials(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    store.delete().map_err(|e| e.to_string())
}

/// Migrate credentials from keyring to encrypted storage
#[tauri::command]
pub async fn migrate_credentials(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    match migrate_from_keyring(&store) {
        MigrationResult::Migrated => Ok("migrated".to_string()),
        MigrationResult::NotNeeded => Ok("not_needed".to_string()),
        MigrationResult::Failed(e) => Err(e),
    }
}

/// Check if credentials exist
#[tauri::command]
pub async fn has_credentials(app: tauri::AppHandle) -> Result<bool, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device_id = DeviceIdGenerator::generate(&app_data_dir).map_err(|e| e.to_string())?;
    let store = CredentialStore::new(&app_data_dir, device_id);

    Ok(store.exists())
}
