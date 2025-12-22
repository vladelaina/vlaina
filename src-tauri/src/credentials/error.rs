//! Error types for credential storage operations

use serde::Serialize;
use thiserror::Error;

/// Errors that can occur during credential operations
#[derive(Debug, Error, Serialize, Clone)]
pub enum CredentialError {
    #[error("凭证文件不存在")]
    NotFound,

    #[error("解密失败 - 设备 ID 可能已变更，请重新登录 Google 账号")]
    DecryptionFailed,

    #[error("设备 ID 不匹配，请重新登录 Google 账号")]
    DeviceMismatch,

    #[error("签名验证失败")]
    SignatureInvalid,

    #[error("存储错误: {0}")]
    StorageError(String),

    #[error("迁移失败: {0}")]
    MigrationError(String),

    #[error("序列化错误: {0}")]
    SerializationError(String),
}

impl From<std::io::Error> for CredentialError {
    fn from(err: std::io::Error) -> Self {
        CredentialError::StorageError(err.to_string())
    }
}

impl From<serde_json::Error> for CredentialError {
    fn from(err: serde_json::Error) -> Self {
        CredentialError::SerializationError(err.to_string())
    }
}
