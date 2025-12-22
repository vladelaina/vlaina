use thiserror::Error;

#[derive(Debug, Error)]
pub enum LicenseError {
    #[error("Failed to get device ID: {0}")]
    DeviceIdError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Signature verification failed")]
    SignatureInvalid,

    #[error("Encryption/Decryption failed: {0}")]
    CryptoError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("API error: {code} - {message}")]
    ApiError { code: String, message: String },

    #[error("License not found")]
    NotFound,

    #[error("Time tampering detected")]
    TimeTamperingDetected,

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<std::io::Error> for LicenseError {
    fn from(err: std::io::Error) -> Self {
        LicenseError::StorageError(err.to_string())
    }
}

impl From<serde_json::Error> for LicenseError {
    fn from(err: serde_json::Error) -> Self {
        LicenseError::SerializationError(err.to_string())
    }
}

impl From<reqwest::Error> for LicenseError {
    fn from(err: reqwest::Error) -> Self {
        LicenseError::NetworkError(err.to_string())
    }
}

// Make LicenseError serializable for Tauri commands
impl serde::Serialize for LicenseError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
