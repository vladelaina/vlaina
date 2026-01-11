//! GitHub sync module
//!
//! This module provides GitHub Gist integration for NekoTick,
//! including OAuth2 PKCE authentication and Gist sync operations.
//! Also provides GitHub Repository API for browsing nekotick-* repos.

pub mod oauth;
pub mod gist_api;
pub mod commands;
pub mod repos;
pub mod repo_commands;

// Re-export commonly used types
pub use oauth::GitHubOAuthClient;
pub use gist_api::GistClient;
pub use repos::RepoClient;
pub use commands::*;
pub use repo_commands::*;
