/**
 * Platform-aware Tauri Invoke Wrapper
 * 
 * Provides safe invoke calls that work on both Tauri and Web platforms
 * On Web, invoke calls return appropriate fallback values or throw errors
 */

import { isTauri } from '@/lib/storage/adapter';

/**
 * Invoke a Tauri command safely
 * 
 * On Tauri: Calls the actual backend command
 * On Web: Returns undefined or throws based on options
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: {
    /** Value to return on web platform */
    webFallback?: T;
    /** If true, throws an error on web platform */
    throwOnWeb?: boolean;
    /** Custom error message for web platform */
    webErrorMessage?: string;
  }
): Promise<T | undefined> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  // Web platform handling
  if (options?.throwOnWeb) {
    throw new Error(options.webErrorMessage || `Command '${command}' is not available on web platform`);
  }

  if (options?.webFallback !== undefined) {
    return options.webFallback;
  }

  console.warn(`[Invoke] Command '${command}' called on web platform, returning undefined`);
  return undefined;
}

/**
 * Check if Tauri commands are available
 */
export function hasBackendCommands(): boolean {
  return isTauri();
}

/**
 * Window control commands (Tauri only)
 */
export const windowCommands = {
  async setResizable(resizable: boolean): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('set_window_resizable', { resizable });
  },

  async toggleFullscreen(): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('toggle_fullscreen');
  },

  async focusWindow(label: string): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('focus_window', { label });
  },

  async createNewWindow(): Promise<void> {
    if (!isTauri()) {
      // On web, open in new tab
      window.open(window.location.href, '_blank');
      return;
    }
    await safeInvoke('create_new_window');
  },
};

/**
 * GitHub sync commands (Tauri only - requires backend)
 */
export const githubCommands = {
  async getGithubSyncStatus() {
    return safeInvoke<{
      connected: boolean;
      username: string | null;
      avatarUrl: string | null;
      gistId: string | null;
      lastSyncTime: number | null;
      hasRemoteData: boolean;
      remoteModifiedTime: string | null;
    }>('get_github_sync_status', undefined, {
      webFallback: {
        connected: false,
        username: null,
        avatarUrl: null,
        gistId: null,
        lastSyncTime: null,
        hasRemoteData: false,
        remoteModifiedTime: null,
      },
    });
  },

  async githubAuth() {
    return safeInvoke<{
      success: boolean;
      username: string | null;
      error: string | null;
    }>('github_auth', undefined, {
      webFallback: {
        success: false,
        username: null,
        error: 'GitHub sync is not available on web platform',
      },
    });
  },

  async githubDisconnect() {
    return safeInvoke('github_disconnect');
  },

  async syncToGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('sync_to_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async restoreFromGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('restore_from_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Restore is not available on web platform',
      },
    });
  },

  async syncGithubBidirectional() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      pulledFromCloud: boolean;
      pushedToCloud: boolean;
      error: string | null;
    }>('sync_github_bidirectional', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        pulledFromCloud: false,
        pushedToCloud: false,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async checkGithubRemoteData() {
    return safeInvoke<{
      exists: boolean;
      modifiedTime: string | null;
      gistId: string | null;
    }>('check_github_remote_data', undefined, {
      webFallback: {
        exists: false,
        modifiedTime: null,
        gistId: null,
      },
    });
  },

  async checkProStatus() {
    return safeInvoke<{
      isPro: boolean;
      licenseKey: string | null;
      expiresAt: number | null;
    }>('check_pro_status', undefined, {
      webFallback: {
        isPro: false,
        licenseKey: null,
        expiresAt: null,
      },
    });
  },

  async bindLicenseKey(licenseKey: string) {
    return safeInvoke<{
      isPro: boolean;
      licenseKey: string | null;
      expiresAt: number | null;
    }>('bind_license_key', { licenseKey }, {
      webFallback: {
        isPro: false,
        licenseKey: null,
        expiresAt: null,
      },
    });
  },
};


// ==================== Web OAuth ====================

const API_BASE = 'https://api.nekotick.com';
const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';

interface WebGithubCredentials {
  accessToken: string;
  username: string;
  avatarUrl?: string;
  gistId?: string;
  lastSyncTime?: number;
}

/** Get stored web credentials */
function getWebGithubCredentials(): WebGithubCredentials | null {
  try {
    const stored = localStorage.getItem(WEB_GITHUB_CREDS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Save web credentials */
function saveWebGithubCredentials(creds: WebGithubCredentials): void {
  localStorage.setItem(WEB_GITHUB_CREDS_KEY, JSON.stringify(creds));
}

/** Clear web credentials */
function clearWebGithubCredentials(): void {
  localStorage.removeItem(WEB_GITHUB_CREDS_KEY);
}

/**
 * Web-specific GitHub OAuth commands
 */
export const webGithubCommands = {
  /** Start OAuth flow - opens GitHub auth in popup/redirect */
  async startAuth(): Promise<{ authUrl: string; state: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/github`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  /** Exchange auth code for token and user info */
  async exchangeCode(code: string): Promise<{
    success: boolean;
    username?: string;
    accessToken?: string;
    avatarUrl?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/auth/github/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        saveWebGithubCredentials({
          accessToken: data.accessToken,
          username: data.username,
          avatarUrl: data.avatarUrl,
        });
      }
      return data;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /** Check if connected on web */
  getStatus(): { connected: boolean; username: string | null; gistId: string | null; lastSyncTime: number | null } {
    const creds = getWebGithubCredentials();
    return {
      connected: !!creds,
      username: creds?.username || null,
      gistId: creds?.gistId || null,
      lastSyncTime: creds?.lastSyncTime || null,
    };
  },

  /** Disconnect on web */
  disconnect(): void {
    clearWebGithubCredentials();
  },

  /** Check PRO status using stored credentials */
  async checkProStatus(): Promise<{ isPro: boolean; licenseKey: string | null; expiresAt: number | null }> {
    const creds = getWebGithubCredentials();
    if (!creds) return { isPro: false, licenseKey: null, expiresAt: null };

    try {
      const res = await fetch(`${API_BASE}/check_pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_username: creds.username }),
      });
      const data = await res.json();
      return {
        isPro: data.isPro || false,
        licenseKey: data.licenseKey || null,
        expiresAt: data.expiresAt || null,
      };
    } catch {
      return { isPro: false, licenseKey: null, expiresAt: null };
    }
  },

  /** Bind license key */
  async bindLicenseKey(licenseKey: string): Promise<{ success: boolean; expiresAt?: number; error?: string }> {
    const creds = getWebGithubCredentials();
    if (!creds) return { success: false, error: 'Not connected' };

    try {
      const res = await fetch(`${API_BASE}/bind_license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, github_username: creds.username }),
      });
      return res.json();
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /** Get access token for Gist API calls */
  getAccessToken(): string | null {
    return getWebGithubCredentials()?.accessToken || null;
  },

  /** Update gist ID after sync */
  updateGistId(gistId: string): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.gistId = gistId;
      saveWebGithubCredentials(creds);
    }
  },

  /** Update last sync time */
  updateLastSyncTime(timestamp: number): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.lastSyncTime = timestamp;
      saveWebGithubCredentials(creds);
    }
  },
};

/** Check for OAuth callback params in URL (call on app init) */
export function handleOAuthCallback(): { code: string; state: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('auth_code');
  const state = params.get('auth_state');
  const error = params.get('auth_error');

  if (error) {
    console.error('[OAuth] Auth error:', error);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    return null;
  }

  if (code) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    return { code, state: state || '' };
  }

  return null;
}

// ==================== GitHub Repository Types ====================

/** Repository info from GitHub API */
export interface RepositoryInfo {
  id: number;
  name: string;
  displayName: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
  description: string | null;
}

/** Tree entry (file or directory) */
export interface TreeEntry {
  path: string;
  name: string;
  entryType: 'file' | 'dir';
  sha: string;
  size?: number;
}

/** File content from repository */
export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

/** Commit result after file update */
export interface CommitResult {
  sha: string;
  message: string;
  htmlUrl?: string;
}

// ==================== GitHub Repository Commands ====================

/**
 * GitHub Repository commands (Tauri only - requires backend)
 * For browsing and managing nekotick-* repositories
 */
export const githubRepoCommands = {
  /** List user's nekotick-* repositories */
  async listRepos(): Promise<RepositoryInfo[]> {
    const result = await safeInvoke<RepositoryInfo[]>('list_github_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },

  /** Get repository directory contents (tree) */
  async getRepoTree(owner: string, repo: string, path: string = ''): Promise<TreeEntry[]> {
    const result = await safeInvoke<TreeEntry[]>('get_repo_tree', { owner, repo, path }, {
      webFallback: [],
    });
    return result || [];
  },

  /** Get file content from repository */
  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    const result = await safeInvoke<FileContent>('get_repo_file_content', { owner, repo, path }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Update or create a file in repository */
  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    sha: string | null,
    message: string
  ): Promise<CommitResult | null> {
    const result = await safeInvoke<CommitResult>('update_repo_file', {
      owner,
      repo,
      path,
      content,
      sha,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Create a new repository with nekotick- prefix */
  async createRepo(
    name: string,
    isPrivate: boolean,
    description?: string
  ): Promise<RepositoryInfo | null> {
    const result = await safeInvoke<RepositoryInfo>('create_github_repo', {
      name,
      private: isPrivate,
      description,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Delete a file from repository */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    message: string
  ): Promise<CommitResult | null> {
    const result = await safeInvoke<CommitResult>('delete_repo_file', {
      owner,
      repo,
      path,
      sha,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },
};

// ==================== Git Local Operations ====================

/** File status in local repository */
export interface FileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed' | 'untracked';
}

/** Commit info from git log */
export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
}

/**
 * Git local operations (Tauri only - requires backend)
 * For cloning, pulling, pushing, and managing local repositories
 */
export const gitCommands = {
  /** Clone a repository to local storage */
  async cloneRepo(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('clone_github_repo', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Check if a repository is cloned locally */
  async isRepoCloned(owner: string, repo: string): Promise<boolean> {
    const result = await safeInvoke<boolean>('is_repo_cloned', { owner, repo }, {
      webFallback: false,
    });
    return result || false;
  },

  /** Get the local path of a cloned repository */
  async getRepoLocalPath(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('get_repo_local_path', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Pull latest changes from remote */
  async pullRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('pull_github_repo', { owner, repo });
  },

  /** Push local changes to remote */
  async pushRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('push_github_repo', { owner, repo });
  },

  /** Commit all changes */
  async commitChanges(
    owner: string,
    repo: string,
    message: string
  ): Promise<string | null> {
    const result = await safeInvoke<string>('commit_repo_changes', {
      owner,
      repo,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  /** Get repository status (changed files) */
  async getStatus(owner: string, repo: string): Promise<FileStatus[]> {
    const result = await safeInvoke<FileStatus[]>('get_repo_status', { owner, repo }, {
      webFallback: [],
    });
    return result || [];
  },

  /** Get commit history */
  async getLog(owner: string, repo: string, limit?: number): Promise<CommitInfo[]> {
    const result = await safeInvoke<CommitInfo[]>('get_repo_log', { owner, repo, limit }, {
      webFallback: [],
    });
    return result || [];
  },

  /** Get diff for a file */
  async getFileDiff(owner: string, repo: string, filePath: string): Promise<string> {
    const result = await safeInvoke<string>('get_file_diff', { owner, repo, filePath }, {
      webFallback: '',
    });
    return result || '';
  },

  /** Delete a local repository */
  async deleteLocalRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('delete_local_repo', { owner, repo });
  },

  /** List all locally cloned repositories */
  async listLocalRepos(): Promise<Array<[string, string]>> {
    const result = await safeInvoke<Array<[string, string]>>('list_local_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },
};
