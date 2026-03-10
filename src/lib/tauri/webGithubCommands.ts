import { commitWebGithubChangeset } from './webGithubChangeset';

const API_BASE = 'https://api.nekotick.com';
const GITHUB_API_BASE = 'https://api.github.com';
const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';

interface WebGithubCredentials {
  username: string;
  githubId?: number;
  avatarUrl?: string;
  accessToken?: string;
  lastSyncTime?: number;
}

interface WebRepoContentsResponse {
  name: string;
  path: string;
  sha: string;
  size?: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

interface WebGitReferenceResponse {
  object: {
    sha: string;
  };
}

interface WebGitCommitLookupResponse {
  tree: {
    sha: string;
  };
}

interface WebGitTreeResponse {
  tree: Array<{
    path: string;
    size?: number | null;
    sha?: string | null;
    type: string;
  }>;
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

function requireAccessToken(): string {
  const token = getWebGithubCredentials()?.accessToken;
  if (!token) {
    throw new Error('Not connected to GitHub');
  }
  return token;
}

function decodeUtf8Base64(input: string): string {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = requireAccessToken();
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
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

  async exchangeCode(
    code: string,
    state: string
  ): Promise<{
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
        body: JSON.stringify({ code, state }),
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        saveWebGithubCredentials({
          username: data.username,
          githubId: data.githubId,
          avatarUrl: data.avatarUrl,
          accessToken: data.accessToken,
        });
      }
      return data;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getStatus(): {
    connected: boolean;
    username: string | null;
    avatarUrl: string | null;
    lastSyncTime: number | null;
  } {
    const creds = getWebGithubCredentials();
    return {
      connected: !!creds?.accessToken,
      username: creds?.username || null,
      avatarUrl: creds?.avatarUrl || null,
      lastSyncTime: creds?.lastSyncTime || null,
    };
  },

  disconnect(): void {
    clearWebGithubCredentials();
  },

  updateLastSyncTime(timestamp: number): void {
    const creds = getWebGithubCredentials();
    if (creds) {
      creds.lastSyncTime = timestamp;
      saveWebGithubCredentials(creds);
    }
  },

  async listRepos() {
    const allRepos: any[] = [];
    let page = 1;

    while (page <= 10) {
      const repos = await githubFetch<any[]>(
        `/user/repos?per_page=100&page=${page}&sort=updated&direction=desc`
      );
      if (repos.length === 0) {
        break;
      }
      allRepos.push(...repos);
      page += 1;
    }

    return allRepos
      .filter((repo) => repo.name.startsWith('nekotick-') && repo.name !== 'nekotick-config')
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        displayName: repo.name.startsWith('nekotick-') ? repo.name.slice('nekotick-'.length) : repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        description: repo.description ?? null,
      }));
  },

  async createRepo(name: string, isPrivate: boolean, description?: string) {
    const fullName = name.startsWith('nekotick-') ? name : `nekotick-${name}`;
    const repo = await githubFetch<any>('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fullName,
        private: isPrivate,
        description,
        auto_init: true,
      }),
    });

    return {
      id: repo.id,
      name: repo.name,
      displayName: repo.name.startsWith('nekotick-') ? repo.name.slice('nekotick-'.length) : repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      description: repo.description ?? null,
    };
  },

  async getRepoTreeRecursive(owner: string, repo: string, branch: string) {
    const reference = await githubFetch<WebGitReferenceResponse>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`
    );
    const headCommitSha = reference.object.sha;

    const commitLookup = await githubFetch<WebGitCommitLookupResponse>(
      `/repos/${owner}/${repo}/git/commits/${headCommitSha}`
    );
    const tree = await githubFetch<WebGitTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${commitLookup.tree.sha}?recursive=1`
    );

    return tree.tree
      .filter((entry) => entry.sha)
      .map((entry) => ({
        path: entry.path,
        name: entry.path.split('/').pop() || entry.path,
        entryType: entry.type === 'tree' ? ('dir' as const) : ('file' as const),
        sha: entry.sha || '',
        size: entry.size ?? undefined,
      }));
  },

  async getFileContent(owner: string, repo: string, path: string) {
    const content = await githubFetch<WebRepoContentsResponse>(`/repos/${owner}/${repo}/contents/${path}`);
    const decodedContent = decodeUtf8Base64((content.content ?? '').replace(/\n/g, ''));
    return {
      path: content.path,
      content: decodedContent,
      sha: content.sha,
      encoding: content.encoding ?? 'base64',
    };
  },

  async commitChangeset(
    owner: string,
    repo: string,
    branch: string,
    message: string,
    operations: Array<{
      operationType: 'upsert' | 'delete';
      path: string;
      content?: string;
      previousSha?: string | null;
    }>
  ) {
    return commitWebGithubChangeset({
      githubFetch,
      owner,
      repo,
      branch,
      message,
      operations,
    });
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
