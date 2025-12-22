use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use chrono::Utc;

use crate::license::{
    api::ApiClient,
    device_id::DeviceIdGenerator,
    store::{LicenseData, LicenseStore},
    LicenseError,
};

// 72 hours in seconds (3 days)
const VALIDATION_INTERVAL_SECS: i64 = 72 * 60 * 60;
// 7 days in seconds (grace period)
const GRACE_PERIOD_SECS: i64 = 7 * 24 * 60 * 60;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LicenseStatus {
    pub is_pro: bool,
    pub license_key: Option<String>,
    pub activated_at: Option<i64>,
    pub last_validated_at: Option<i64>,
    pub needs_validation: bool,
    pub in_grace_period: bool,
    pub grace_period_ends_at: Option<i64>,
    pub time_tamper_detected: bool,
}

impl Default for LicenseStatus {
    fn default() -> Self {
        Self {
            is_pro: false,
            license_key: None,
            activated_at: None,
            last_validated_at: None,
            needs_validation: false,
            in_grace_period: false,
            grace_period_ends_at: None,
            time_tamper_detected: false,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct ActivationResult {
    pub success: bool,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct ValidationResult {
    pub success: bool,
    pub downgraded: bool,
    pub in_grace_period: bool,
}

pub struct LicenseManager {
    store: LicenseStore,
    api_client: ApiClient,
    device_id: String,
}

impl LicenseManager {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, LicenseError> {
        let device_id = DeviceIdGenerator::generate(&app_data_dir)?;
        let store = LicenseStore::new(&app_data_dir, device_id.clone());
        let api_client = ApiClient::new()?;

        Ok(Self {
            store,
            api_client,
            device_id,
        })
    }

    pub fn get_device_id(&self) -> &str {
        &self.device_id
    }

    /// Activate license with server
    pub async fn activate(&self, license_key: &str) -> Result<ActivationResult, LicenseError> {
        // Call API
        let response = self.api_client.activate(license_key, &self.device_id).await?;

        if response.success {
            let activated_at = response.activated_at.unwrap_or_else(|| Utc::now().timestamp());
            let now = Utc::now().timestamp();

            // Create and save license data
            let data = LicenseData::new(
                license_key.to_string(),
                self.device_id.clone(),
                activated_at,
                now,
            );
            self.store.save(&data)?;

            Ok(ActivationResult {
                success: true,
                error_code: None,
                error_message: None,
            })
        } else {
            Ok(ActivationResult {
                success: false,
                error_code: response.error_code,
                error_message: response.error,
            })
        }
    }

    /// Deactivate license (unbind device)
    pub async fn deactivate(&self) -> Result<(), LicenseError> {
        // Load current license
        let data = self.store.load()?;

        // Call API
        let response = self
            .api_client
            .deactivate(&data.license_key, &self.device_id)
            .await?;

        if response.success {
            // Delete local license
            self.store.delete()?;
            Ok(())
        } else {
            Err(LicenseError::ApiError {
                code: response.error_code.unwrap_or_default(),
                message: response.error.unwrap_or_else(|| "Deactivation failed".to_string()),
            })
        }
    }

    /// Get current license status (considers grace period and time tampering)
    pub fn get_status(&self) -> LicenseStatus {
        let data = match self.store.load() {
            Ok(d) => d,
            Err(_) => return LicenseStatus::default(),
        };

        let now = Utc::now().timestamp();
        let time_since_validation = now - data.last_validated_at;

        // Check for time tampering
        let time_tamper_detected = self.detect_time_tampering(&data);

        // Calculate if validation is needed
        let needs_validation = time_tamper_detected || time_since_validation > VALIDATION_INTERVAL_SECS;

        // Calculate grace period status (not allowed if time tampered)
        let in_grace_period = !time_tamper_detected
            && time_since_validation > VALIDATION_INTERVAL_SECS
            && time_since_validation <= GRACE_PERIOD_SECS;

        let grace_period_ends_at = if in_grace_period {
            Some(data.last_validated_at + GRACE_PERIOD_SECS)
        } else {
            None
        };

        // Determine PRO status
        // PRO if: (within validation interval OR within grace period) AND no time tampering
        // If time tampered, must validate online first
        let is_pro = !time_tamper_detected && time_since_validation <= GRACE_PERIOD_SECS;

        // Mask license key for display (show only last 4 chars)
        let masked_key = mask_license_key(&data.license_key);

        LicenseStatus {
            is_pro,
            license_key: Some(masked_key),
            activated_at: Some(data.activated_at),
            last_validated_at: Some(data.last_validated_at),
            needs_validation,
            in_grace_period,
            grace_period_ends_at,
            time_tamper_detected,
        }
    }

    /// Background silent validation
    pub async fn validate_background(&self) -> Result<ValidationResult, LicenseError> {
        let mut data = match self.store.load() {
            Ok(d) => d,
            Err(LicenseError::NotFound) => {
                return Ok(ValidationResult {
                    success: false,
                    downgraded: false,
                    in_grace_period: false,
                });
            }
            Err(e) => return Err(e),
        };

        // Check time tampering - if detected, must validate online
        let time_tampered = self.detect_time_tampering(&data);

        // Try to validate with server
        match self.api_client.validate(&data.license_key, &self.device_id).await {
            Ok(response) => {
                if response.success {
                    // Update validation timestamp
                    let now = Utc::now().timestamp();
                    data.update_validation_time(now);
                    self.store.save(&data)?;

                    Ok(ValidationResult {
                        success: true,
                        downgraded: false,
                        in_grace_period: false,
                    })
                } else {
                    // License invalid/expired - downgrade
                    self.store.delete()?;

                    Ok(ValidationResult {
                        success: false,
                        downgraded: true,
                        in_grace_period: false,
                    })
                }
            }
            Err(_) => {
                // Network error - check grace period
                // If time was tampered, don't allow grace period
                if time_tampered {
                    return Ok(ValidationResult {
                        success: false,
                        downgraded: false,
                        in_grace_period: false,
                    });
                }

                let now = Utc::now().timestamp();
                let time_since_validation = now - data.last_validated_at;

                if time_since_validation <= GRACE_PERIOD_SECS {
                    // Still in grace period - update seen time
                    data.update_seen_time_and_signature();
                    self.store.save(&data)?;

                    Ok(ValidationResult {
                        success: false,
                        downgraded: false,
                        in_grace_period: true,
                    })
                } else {
                    // Grace period expired - downgrade
                    self.store.delete()?;

                    Ok(ValidationResult {
                        success: false,
                        downgraded: true,
                        in_grace_period: false,
                    })
                }
            }
        }
    }

    /// Detect if system time has been tampered (rolled back)
    fn detect_time_tampering(&self, data: &LicenseData) -> bool {
        let current_time = Utc::now().timestamp();
        // If current time is before last seen time, time was rolled back
        current_time < data.last_seen_system_time
    }
}

/// Mask license key for display (e.g., "NEKO-****-****-5678")
fn mask_license_key(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() >= 4 {
        format!("{}-****-****-{}", parts[0], parts[parts.len() - 1])
    } else {
        "****".to_string()
    }
}
