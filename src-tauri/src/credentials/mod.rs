//! Encrypted credential storage module
//!
//! This module provides secure storage for OAuth tokens using AES-256-GCM encryption.
//! Credentials are bound to the device ID, preventing unauthorized access if the
//! device ID changes (e.g., after a reset attempt to bypass trial limits).

pub mod encrypted_store;
pub mod error;
pub mod migration;
pub mod commands;

pub use encrypted_store::{CredentialStore, StoredCredentials};
pub use error::CredentialError;
