//! Git operations using libgit2
//! 
//! Provides clone, pull, push, status, log, and diff functionality
//! for local repository management.

use git2::{
    Cred, CredentialType, FetchOptions, PushOptions, RemoteCallbacks,
    Repository, Signature, StatusOptions, DiffOptions,
    build::RepoBuilder,
};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Repository not found at {0}")]
    RepoNotFound(String),
    #[error("No GitHub token available")]
    NoToken,
    #[error("Invalid repository URL")]
    InvalidUrl,
}

/// Get the base directory for cloned repositories
pub fn get_repos_base_dir() -> Result<PathBuf, GitError> {
    let base = dirs::data_local_dir()
        .or_else(|| dirs::home_dir())
        .ok_or_else(|| GitError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Could not find data directory"
        )))?;
    
    Ok(base.join("NekoTick").join("repos"))
}

/// Get the local path for a specific repository
/// Uses "__" as separator since GitHub usernames/repo names cannot contain consecutive underscores
pub fn get_repo_local_path(owner: &str, repo: &str) -> Result<PathBuf, GitError> {
    Ok(get_repos_base_dir()?.join(format!("{}__{}", owner, repo)))
}

/// Check if a repository is already cloned locally
/// Also checks for old format (owner-repo) and migrates if found
pub fn is_repo_cloned(owner: &str, repo: &str) -> Result<bool, GitError> {
    let new_path = get_repo_local_path(owner, repo)?;
    
    // Check new format first
    if new_path.exists() && new_path.join(".git").exists() {
        return Ok(true);
    }
    
    // Check old format (owner-repo) and migrate if found
    let base_dir = get_repos_base_dir()?;
    let old_path = base_dir.join(format!("{}-{}", owner, repo));
    
    if old_path.exists() && old_path.join(".git").exists() {
        // Migrate to new format
        if let Err(e) = std::fs::rename(&old_path, &new_path) {
            // If rename fails, still return true since the repo exists
            eprintln!("Failed to migrate repo directory: {}", e);
            return Ok(true);
        }
        return Ok(true);
    }
    
    Ok(false)
}

/// Create git credentials callback using GitHub token
fn create_callbacks(token: &str) -> RemoteCallbacks<'_> {
    let mut callbacks = RemoteCallbacks::new();
    let token = token.to_string();
    
    callbacks.credentials(move |_url, username_from_url, allowed_types| {
        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
            // Use token as password with any username (GitHub accepts this)
            Cred::userpass_plaintext(
                username_from_url.unwrap_or("x-access-token"),
                &token
            )
        } else {
            Err(git2::Error::from_str("Unsupported credential type"))
        }
    });
    
    callbacks
}

/// Clone a repository from GitHub
pub fn clone_repo(
    owner: &str,
    repo: &str,
    token: &str,
) -> Result<PathBuf, GitError> {
    let url = format!("https://github.com/{}/{}.git", owner, repo);
    let local_path = get_repo_local_path(owner, repo)?;
    
    // Create parent directories if needed
    if let Some(parent) = local_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    
    // Remove existing directory if it exists but is not a valid repo
    if local_path.exists() {
        if !local_path.join(".git").exists() {
            std::fs::remove_dir_all(&local_path)?;
        } else {
            // Already cloned, just return the path
            return Ok(local_path);
        }
    }
    
    let callbacks = create_callbacks(token);
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    
    RepoBuilder::new()
        .fetch_options(fetch_options)
        .clone(&url, &local_path)?;
    
    Ok(local_path)
}


/// Open an existing local repository
pub fn open_repo(owner: &str, repo: &str) -> Result<Repository, GitError> {
    let path = get_repo_local_path(owner, repo)?;
    if !path.exists() {
        return Err(GitError::RepoNotFound(path.display().to_string()));
    }
    Ok(Repository::open(&path)?)
}

/// Pull latest changes from remote
pub fn pull_repo(owner: &str, repo: &str, token: &str) -> Result<(), GitError> {
    let repo = open_repo(owner, repo)?;
    
    // Fetch from origin
    let mut remote = repo.find_remote("origin")?;
    let callbacks = create_callbacks(token);
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    
    remote.fetch(&["main", "master"], Some(&mut fetch_options), None)?;
    
    // Get the fetch head
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    
    // Perform merge (fast-forward if possible)
    let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;
    
    if analysis.is_up_to_date() {
        return Ok(());
    }
    
    if analysis.is_fast_forward() {
        // Fast-forward merge
        let refname = "refs/heads/main";
        let mut reference = match repo.find_reference(refname) {
            Ok(r) => r,
            Err(_) => repo.find_reference("refs/heads/master")?,
        };
        reference.set_target(fetch_commit.id(), "Fast-forward")?;
        repo.set_head(reference.name().unwrap())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
    }
    
    Ok(())
}

/// Push local changes to remote
pub fn push_repo(owner: &str, repo: &str, token: &str) -> Result<(), GitError> {
    let repo = open_repo(owner, repo)?;
    let mut remote = repo.find_remote("origin")?;
    
    let callbacks = create_callbacks(token);
    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);
    
    // Try main first, then master
    let refspec = match repo.find_reference("refs/heads/main") {
        Ok(_) => "refs/heads/main:refs/heads/main",
        Err(_) => "refs/heads/master:refs/heads/master",
    };
    
    remote.push(&[refspec], Some(&mut push_options))?;
    
    Ok(())
}

/// Commit all changes in the repository
pub fn commit_all(
    owner: &str,
    repo_name: &str,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> Result<String, GitError> {
    let repo = open_repo(owner, repo_name)?;
    let mut index = repo.index()?;
    
    // Add all changes
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    
    let signature = Signature::now(author_name, author_email)?;
    
    // Get parent commit
    let parent = match repo.head() {
        Ok(head) => Some(repo.find_commit(head.target().unwrap())?),
        Err(_) => None,
    };
    
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    
    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &parents,
    )?;
    
    Ok(commit_id.to_string())
}


/// File status in the repository
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "new", "modified", "deleted", "renamed", "untracked"
}

/// Get status of all files in the repository
pub fn get_status(owner: &str, repo_name: &str) -> Result<Vec<FileStatus>, GitError> {
    let repo = open_repo(owner, repo_name)?;
    let mut options = StatusOptions::new();
    options.include_untracked(true);
    options.recurse_untracked_dirs(true);
    
    let statuses = repo.statuses(Some(&mut options))?;
    let mut result = Vec::new();
    
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();
        
        let status_str = if status.is_index_new() || status.is_wt_new() {
            "new"
        } else if status.is_index_modified() || status.is_wt_modified() {
            "modified"
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            "deleted"
        } else if status.is_index_renamed() || status.is_wt_renamed() {
            "renamed"
        } else {
            "untracked"
        };
        
        result.push(FileStatus {
            path,
            status: status_str.to_string(),
        });
    }
    
    Ok(result)
}

/// Commit log entry
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
}

/// Get commit history
pub fn get_log(owner: &str, repo_name: &str, limit: usize) -> Result<Vec<CommitInfo>, GitError> {
    let repo = open_repo(owner, repo_name)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    
    let mut commits = Vec::new();
    
    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        
        commits.push(CommitInfo {
            id: oid.to_string(),
            short_id: oid.to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author_name: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        });
    }
    
    Ok(commits)
}

/// Get diff for a specific file
pub fn get_file_diff(
    owner: &str,
    repo_name: &str,
    file_path: &str,
) -> Result<String, GitError> {
    let repo = open_repo(owner, repo_name)?;
    
    let mut diff_options = DiffOptions::new();
    diff_options.pathspec(file_path);
    
    let diff = repo.diff_index_to_workdir(None, Some(&mut diff_options))?;
    
    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            ' ' => " ",
            _ => "",
        };
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(prefix);
            diff_text.push_str(content);
        }
        true
    })?;
    
    Ok(diff_text)
}

/// Delete a local repository
pub fn delete_local_repo(owner: &str, repo: &str) -> Result<(), GitError> {
    let path = get_repo_local_path(owner, repo)?;
    if path.exists() {
        std::fs::remove_dir_all(&path)?;
    }
    Ok(())
}

/// List all locally cloned repositories
pub fn list_local_repos() -> Result<Vec<(String, String)>, GitError> {
    let base_dir = get_repos_base_dir()?;
    let mut repos = Vec::new();
    
    if !base_dir.exists() {
        return Ok(repos);
    }
    
    for entry in std::fs::read_dir(&base_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() && path.join(".git").exists() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                // Parse "owner__repo" format using "__" as separator
                // This is safe because GitHub usernames/repo names cannot contain "__"
                if let Some(pos) = name.find("__") {
                    let owner = &name[..pos];
                    let repo = &name[pos + 2..]; // Skip the "__"
                    if !owner.is_empty() && !repo.is_empty() {
                        repos.push((owner.to_string(), repo.to_string()));
                    }
                }
            }
        }
    }
    
    Ok(repos)
}
