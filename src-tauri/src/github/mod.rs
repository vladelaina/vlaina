//! GitHub sync module
//!
//! Provides GitHub integration for NekoTick:
//! OAuth2 authentication, repository-based config sync (nekotick-config),
//! nekotick-* notebook repos, and local git operations via libgit2.

pub mod oauth;
pub mod commands;
pub mod repos;
pub mod repo_commands;
pub mod git_ops;
pub mod git_commands;
pub mod config_sync;
pub mod config_commands;

pub use oauth::GitHubOAuthClient;
pub use repos::RepoClient;
pub use commands::*;
pub use repo_commands::*;
pub use git_commands::*;
pub use config_commands::*;
