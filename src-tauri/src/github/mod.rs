//! GitHub sync module
//!
//! This module provides GitHub Gist integration for NekoTick,
//! including OAuth2 PKCE authentication and Gist sync operations.

pub mod oauth;
pub mod gist_api;
pub mod commands;

// Re-export commonly used types
pub use oauth::GitHubOAuthClient;
pub use gist_api::GistClient;
pub use commands::*;
