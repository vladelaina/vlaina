// License activation module
// Implements device-bound license verification for NekoTick PRO features

pub mod device_id;
pub mod store;
pub mod api;
pub mod manager;
pub mod commands;
pub mod error;

pub use error::LicenseError;
pub use manager::LicenseManager;
pub use commands::*;
