import {
  clearWebGithubCredentials,
  getCachedWebGithubStatus,
  loadWebGithubCredentials,
  saveWebGithubCredentials,
  type WebGithubStatus,
} from './webGithubSession';

const API_BASE = 'https://api.nekotick.com';
const MANAGED_MODELS_URL = `${API_BASE}/v1/models`;
const WEB_RESULT_POLL_ATTEMPTS = 10;
const WEB_RESULT_POLL_DELAY_MS = 300;
const WEB_REPO_UNSUPPORTED_ERROR =
  'GitHub repository sync is only available in the desktop app';

interface WebAuthResult {
  success: boolean;
  pending?: boolean;
  username?: string;
  githubId?: number;
  avatarUrl?: string;
  error?: string;
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

async function probeWebSession(): Promise<boolean> {
  const response = await fetch(MANAGED_MODELS_URL, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 401 || response.status === 403) {
    clearWebGithubCredentials();
    return false;
  }

  throw new Error(`Failed to verify session: HTTP ${response.status}`);
}

async function revokeWebSession(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/session/revoke`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.ok || response.status === 401 || response.status === 403) {
    return;
  }

  throw new Error(`Failed to revoke session: HTTP ${response.status}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const webGithubCommands = {
  clearClientSession(): void {
    clearWebGithubCredentials();
  },

  async startAuth(): Promise<{ authUrl: string; state: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/github`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async completeAuth(state: string): Promise<{
    success: boolean;
    username?: string;
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
          credentials: 'include',
        });
        const data = (await res.json()) as WebAuthResult;
        if (data.pending === true && !data.success) {
          await delay(WEB_RESULT_POLL_DELAY_MS);
          continue;
        }
        if (data.success && data.username) {
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
    avatarUrl?: string;
    error?: string;
  }> {
    return this.completeAuth(state);
  },

  getStatus(): WebGithubStatus {
    return getCachedWebGithubStatus();
  },

  async probeStatus(): Promise<WebGithubStatus> {
    const cached = getCachedWebGithubStatus();
    try {
      const connected = await probeWebSession();
      return {
        ...cached,
        connected,
      };
    } catch {
      return cached;
    }
  },

  async disconnect(): Promise<void> {
    await revokeWebSession();
    clearWebGithubCredentials();
  },

  updateLastSyncTime(timestamp: number): void {
    const creds = loadWebGithubCredentials();
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

  if (oauthState && code) {
    window.history.replaceState({}, '', window.location.pathname);
    return { state: oauthState, error: null, code };
  }

  return null;
}
