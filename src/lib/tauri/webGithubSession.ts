const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';
const LEGACY_WEB_SESSION_TOKEN_KEY = 'nekotick_session_token';
const GITHUB_USER_PERSIST_KEY = 'nekotick_github_user_identity';
export const GITHUB_AUTH_INVALIDATED_EVENT = 'nekotick:github-auth-invalidated';

export interface WebGithubCredentials {
  username: string;
  githubId?: number;
  avatarUrl?: string;
  lastSyncTime?: number;
}

export interface WebGithubStatus {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  lastSyncTime: number | null;
}

function clearPersistedGithubIdentity(): void {
  try {
    localStorage.removeItem(GITHUB_USER_PERSIST_KEY);
  } catch {
    // no-op
  }
}

function clearLegacyWebGithubStorage(): void {
  try {
    localStorage.removeItem(WEB_GITHUB_CREDS_KEY);
  } catch {
    // no-op
  }

  try {
    localStorage.removeItem(LEGACY_WEB_SESSION_TOKEN_KEY);
  } catch {
    // no-op
  }

  try {
    sessionStorage.removeItem(LEGACY_WEB_SESSION_TOKEN_KEY);
  } catch {
    // no-op
  }
}

export function loadWebGithubCredentials(): WebGithubCredentials | null {
  clearLegacyWebGithubStorage();
  try {
    const stored = sessionStorage.getItem(WEB_GITHUB_CREDS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveWebGithubCredentials(creds: WebGithubCredentials): void {
  clearLegacyWebGithubStorage();
  sessionStorage.setItem(WEB_GITHUB_CREDS_KEY, JSON.stringify(creds));
}

export function clearWebGithubCredentials(): void {
  clearLegacyWebGithubStorage();
  clearPersistedGithubIdentity();
  try {
    sessionStorage.removeItem(WEB_GITHUB_CREDS_KEY);
  } catch {
    // no-op
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GITHUB_AUTH_INVALIDATED_EVENT));
  }
}

export function getCachedWebGithubStatus(): WebGithubStatus {
  const creds = loadWebGithubCredentials();
  return {
    connected: false,
    username: creds?.username || null,
    avatarUrl: creds?.avatarUrl || null,
    lastSyncTime: creds?.lastSyncTime || null,
  };
}
