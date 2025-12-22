use tauri::AppHandle;

use crate::license::{
    manager::{ActivationResult, LicenseManager, LicenseStatus, ValidationResult},
    LicenseError,
};

/// Get the app data directory for license storage
fn get_app_data_dir(_app: &AppHandle) -> Result<std::path::PathBuf, LicenseError> {
    // Use home directory with .nekotick folder
    let home = dirs::home_dir()
        .ok_or_else(|| LicenseError::StorageError("Cannot find home directory".into()))?;
    Ok(home.join(".nekotick"))
}

/// Get device ID
#[tauri::command]
pub async fn get_device_id(app: AppHandle) -> Result<String, LicenseError> {
    let app_data_dir = get_app_data_dir(&app)?;
    let manager = LicenseManager::new(app_data_dir)?;
    Ok(manager.get_device_id().to_string())
}

/// Activate license with key
#[tauri::command]
pub async fn activate_license(
    app: AppHandle,
    license_key: String,
) -> Result<ActivationResult, LicenseError> {
    let app_data_dir = get_app_data_dir(&app)?;
    let manager = LicenseManager::new(app_data_dir)?;
    manager.activate(&license_key).await
}

/// Deactivate license (unbind device)
#[tauri::command]
pub async fn deactivate_license(app: AppHandle) -> Result<(), LicenseError> {
    let app_data_dir = get_app_data_dir(&app)?;
    let manager = LicenseManager::new(app_data_dir)?;
    manager.deactivate().await
}

/// Get current license status
#[tauri::command]
pub async fn get_license_status(app: AppHandle) -> Result<LicenseStatus, LicenseError> {
    let app_data_dir = get_app_data_dir(&app)?;
    let manager = LicenseManager::new(app_data_dir)?;
    Ok(manager.get_status())
}

/// Background silent validation
#[tauri::command]
pub async fn validate_license_background(
    app: AppHandle,
) -> Result<ValidationResult, LicenseError> {
    let app_data_dir = get_app_data_dir(&app)?;
    let manager = LicenseManager::new(app_data_dir)?;
    manager.validate_background().await
}
