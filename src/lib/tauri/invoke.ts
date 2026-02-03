import { isTauri } from '@/lib/storage/adapter';

export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: {
    webFallback?: T;
    throwOnWeb?: boolean;
    webErrorMessage?: string;
  }
): Promise<T | undefined> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  if (options?.throwOnWeb) {
    throw new Error(options.webErrorMessage || `Command '${command}' is not available on web platform`);
  }

  if (options?.webFallback !== undefined) {
    return options.webFallback;
  }

  console.warn(`[Invoke] Command '${command}' called on web platform, returning undefined`);
  return undefined;
}

export function hasBackendCommands(): boolean {
  return isTauri();
}

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
      window.open(window.location.href, '_blank');
      return;
    }
    await safeInvoke('create_new_window');
  },
};

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
      expiresAt: number | null;
    }>('check_pro_status', undefined, {
      webFallback: {
        isPro: false,
        expiresAt: null,
      },
    });
  },
};


const API_BASE = 'https://api.nekotick.com';
const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';

interface WebGithubCredentials {
  accessToken: string;
  username: string;
  githubId?: number;
  avatarUrl?: string;
  gistId?: string;
  lastSyncTime?: number;
}

function getWebGithubCredentials(): WebGithubCredentials | null {
  try {
    const stored = localStorage.getItem(WEB_GITHUB_CREDS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveWebGithubCredentials(creds: WebGithubCredentials): void {
  localStorage.setItem(WEB_GITHUB_CREDS_KEY, JSON.stringify(creds));
}

function clearWebGithubCredentials(): void {
  localStorage.removeItem(WEB_GITHUB_CREDS_KEY);
}

export const webGithubCommands = {
  async startAuth(): Promise<{ authUrl: string; state: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/github`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

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
          githubId: data.githubId,
          avatarUrl: data.avatarUrl,
        });
      }
      return data;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  getStatus(): { connected: boolean; username: string | null; avatarUrl: string | null; gistId: string | null; lastSyncTime: number | null } {
    const creds = getWebGithubCredentials();
    return {
      connected: !!creds,
      username: creds?.username || null,
      avatarUrl: creds?.avatarUrl || null,
      gistId: creds?.gistId || null,
      lastSyncTime: creds?.lastSyncTime || null,
    };
  },

  disconnect(): void {
    clearWebGithubCredentials();
  },

  async checkProStatus(): Promise<{ isPro: boolean; expiresAt: number | null }> {
    const creds = getWebGithubCredentials();
    if (!creds || !creds.githubId) return { isPro: false, expiresAt: null };

    try {
      const res = await fetch(`${API_BASE}/check_pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_id: creds.githubId }),
      });
      const data = await res.json();
      return {
        isPro: data.isPro || false,
        expiresAt: data.expiresAt || null,
      };
    } catch {
      return { isPro: false, expiresAt: null };
    }
  },

  getAccessToken(): string | null {
    return getWebGithubCredentials()?.accessToken || null;
  },

  updateGistId(gistId: string): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.gistId = gistId;
      saveWebGithubCredentials(creds);
    }
  },

  updateLastSyncTime(timestamp: number): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.lastSyncTime = timestamp;
      saveWebGithubCredentials(creds);
    }
  },
};

export function handleOAuthCallback(): { code: string; state: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('auth_code');
  const state = params.get('auth_state');
  const error = params.get('auth_error');

  if (error) {
    console.error('[OAuth] Auth error:', error);
    window.history.replaceState({}, '', window.location.pathname);
    return null;
  }

  if (code) {
    window.history.replaceState({}, '', window.location.pathname);
    return { code, state: state || '' };
  }

  return null;
}

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

export interface TreeEntry {
  path: string;
  name: string;
  entryType: 'file' | 'dir';
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

export interface CommitResult {
  sha: string;
  message: string;
  htmlUrl?: string;
}

export const githubRepoCommands = {
  async listRepos(): Promise<RepositoryInfo[]> {
    const result = await safeInvoke<RepositoryInfo[]>('list_github_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },

  async getRepoTree(owner: string, repo: string, path: string = ''): Promise<TreeEntry[]> {
    const result = await safeInvoke<TreeEntry[]>('get_repo_tree', { owner, repo, path }, {
      webFallback: [],
    });
    return result || [];
  },

  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    const result = await safeInvoke<FileContent>('get_repo_file_content', { owner, repo, path }, {
      webFallback: undefined,
    });
    return result || null;
  },

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

export interface FileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed' | 'untracked';
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
}

export const gitCommands = {
  async cloneRepo(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('clone_github_repo', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async isRepoCloned(owner: string, repo: string): Promise<boolean> {
    const result = await safeInvoke<boolean>('is_repo_cloned', { owner, repo }, {
      webFallback: false,
    });
    return result || false;
  },

  async getRepoLocalPath(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('get_repo_local_path', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async pullRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('pull_github_repo', { owner, repo });
  },

  async pushRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('push_github_repo', { owner, repo });
  },

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

  async getStatus(owner: string, repo: string): Promise<FileStatus[]> {
    const result = await safeInvoke<FileStatus[]>('get_repo_status', { owner, repo }, {
      webFallback: [],
    });
    return result || [];
  },

  async getLog(owner: string, repo: string, limit?: number): Promise<CommitInfo[]> {
    const result = await safeInvoke<CommitInfo[]>('get_repo_log', { owner, repo, limit }, {
      webFallback: [],
    });
    return result || [];
  },

  async getFileDiff(owner: string, repo: string, filePath: string): Promise<string> {
    const result = await safeInvoke<string>('get_file_diff', { owner, repo, filePath }, {
      webFallback: '',
    });
    return result || '';
  },

  async deleteLocalRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('delete_local_repo', { owner, repo });
  },

  async listLocalRepos(): Promise<Array<[string, string]>> {
    const result = await safeInvoke<Array<[string, string]>>('list_local_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },
};
