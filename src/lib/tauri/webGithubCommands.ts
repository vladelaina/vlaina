const API_BASE = 'https://api.nekotick.com';
const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';

interface WebGithubCredentials {
  username: string;
  githubId?: number;
  avatarUrl?: string;
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

  async exchangeCode(code: string, state: string): Promise<{
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
        });
      }
      return data;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  getStatus(): { connected: boolean; username: string | null; avatarUrl: string | null; lastSyncTime: number | null } {
    const creds = getWebGithubCredentials();
    return {
      connected: !!creds,
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
