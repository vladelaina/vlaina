const API_BASE = 'https://api.nekotick.com';
const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';
const WEB_SESSION_TOKEN_KEY = 'nekotick_session_token';
const WEB_RESULT_POLL_ATTEMPTS = 10;
const WEB_RESULT_POLL_DELAY_MS = 300;
const WEB_REPO_UNSUPPORTED_ERROR =
  'GitHub repository sync is only available in the desktop app';

interface WebGithubCredentials {
  username: string;
  githubId?: number;
  avatarUrl?: string;
  lastSyncTime?: number;
}

interface WebRepoChangeOperation {
  operationType: 'upsert' | 'delete';
  path: string;
  content?: string;
  previousSha?: string | null;
}

interface WebRepoCommitResult {
  sha: string;
  message: string;
  htmlUrl?: string;
}

interface WebRepoCommitConflict {
  path: string;
  reason: 'modified' | 'deleted' | 'created';
}

interface WebRepoCommittedFile {
  path: string;
  sha: string;
}

interface WebRepoChangesetCommitResult {
  status: 'committed' | 'conflict';
  commit: WebRepoCommitResult | null;
  conflicts: WebRepoCommitConflict[];
  updatedFiles: WebRepoCommittedFile[];
}

function unsupportedWebRepoError(): Error {
  return new Error(WEB_REPO_UNSUPPORTED_ERROR);
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

function getWebSessionToken(): string | null {
  try {
    const token = sessionStorage.getItem(WEB_SESSION_TOKEN_KEY) || '';
    const normalized = token.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function saveWebSessionToken(token: string): void {
  try {
    sessionStorage.setItem(WEB_SESSION_TOKEN_KEY, token);
  } catch {
    // no-op
  }
}

function clearWebSessionToken(): void {
  try {
    sessionStorage.removeItem(WEB_SESSION_TOKEN_KEY);
  } catch {
    // no-op
  }
}

function clearWebGithubCredentials(): void {
  localStorage.removeItem(WEB_GITHUB_CREDS_KEY);
}

async function revokeWebSession(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${API_BASE}/auth/session/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
  } catch {
    // no-op
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const webGithubCommands = {
  async startAuth(): Promise<{ authUrl: string; state: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/github`, { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async completeAuth(state: string): Promise<{
    success: boolean;
    username?: string;
    sessionToken?: string;
    avatarUrl?: string;
    error?: string;
  }> {
    try {
      const endpoint = new URL(`${API_BASE}/auth/github/web/result`);
      endpoint.searchParams.set('state', state);
      for (let attempt = 0; attempt < WEB_RESULT_POLL_ATTEMPTS; attempt += 1) {
        const res = await fetch(endpoint, {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.pending === true && !data.success) {
          await delay(WEB_RESULT_POLL_DELAY_MS);
          continue;
        }
        if (data.success && data.sessionToken) {
          saveWebSessionToken(data.sessionToken);
          saveWebGithubCredentials({
            username: data.username,
            githubId: data.githubId,
            avatarUrl: data.avatarUrl,
          });
        }
        return data;
      }
      return { success: false, error: 'OAuth result timed out' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async exchangeCode(
    _code: string | null | undefined,
    state: string
  ): Promise<{
    success: boolean;
    username?: string;
    sessionToken?: string;
    avatarUrl?: string;
    error?: string;
  }> {
    return this.completeAuth(state);
  },

  getStatus(): {
    connected: boolean;
    username: string | null;
    avatarUrl: string | null;
    lastSyncTime: number | null;
  } {
    const creds = getWebGithubCredentials();
    const token = getWebSessionToken();
    const connected = !!creds && !!token;
    return {
      connected,
      username: connected ? creds?.username || null : null,
      avatarUrl: connected ? creds?.avatarUrl || null : null,
      lastSyncTime: creds?.lastSyncTime || null,
    };
  },

  async disconnect(): Promise<void> {
    const token = getWebSessionToken();
    clearWebSessionToken();
    clearWebGithubCredentials();
    await revokeWebSession(token);
  },

  getSessionToken(): string | null {
    return getWebSessionToken();
  },

  updateLastSyncTime(timestamp: number): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.lastSyncTime = timestamp;
      saveWebGithubCredentials(creds);
    }
  },

  async listRepos(): Promise<never> {
    throw unsupportedWebRepoError();
  },

  async createRepo(
    _name: string,
    _isPrivate: boolean,
    _description?: string
  ): Promise<never> {
    throw unsupportedWebRepoError();
  },

  async getRepoTreeRecursive(
    _owner: string,
    _repo: string,
    _branch: string
  ): Promise<never> {
    throw unsupportedWebRepoError();
  },

  async getFileContent(_owner: string, _repo: string, _path: string): Promise<never> {
    throw unsupportedWebRepoError();
  },

  async commitChangeset(
    _owner: string,
    _repo: string,
    _branch: string,
    _message: string,
    _operations: WebRepoChangeOperation[]
  ): Promise<WebRepoChangesetCommitResult> {
    throw unsupportedWebRepoError();
  },
};

export function handleOAuthCallback():
  | { state: string | null; error: string | null; code?: string | null }
  | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthState = params.get('state');
  const state = params.get('auth_state');
  const error = params.get('auth_error');
  const callbackError = params.get('error');

  if (error || callbackError) {
    window.history.replaceState({}, '', window.location.pathname);
    return { state: state ?? oauthState, error: error ?? callbackError, code };
  }

  if (state) {
    window.history.replaceState({}, '', window.location.pathname);
    return { state, error: null, code };
  }

  if (code && oauthState) {
    window.history.replaceState({}, '', window.location.pathname);
    return { state: oauthState, error: null, code };
  }

  return null;
}
