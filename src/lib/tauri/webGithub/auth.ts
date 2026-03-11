import { API_BASE } from './client';
import {
  clearWebGithubCredentials,
  getWebGithubCredentials,
  saveWebGithubCredentials,
} from './credentials';

export async function startWebGithubAuth(): Promise<{ authUrl: string; state: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/github`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function exchangeWebGithubCode(
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
}

export function getWebGithubStatus(): {
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
}

export function disconnectWebGithub(): void {
  clearWebGithubCredentials();
}

export function updateWebGithubLastSyncTime(timestamp: number): void {
  const creds = getWebGithubCredentials();
  if (!creds) return;
  creds.lastSyncTime = timestamp;
  saveWebGithubCredentials(creds);
}

export function parseWebGithubOAuthCallback(): { code: string; state: string } | null {
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
