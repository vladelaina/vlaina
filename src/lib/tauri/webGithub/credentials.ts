const WEB_GITHUB_CREDS_KEY = 'nekotick_github_creds';

export interface WebGithubCredentials {
  username: string;
  githubId?: number;
  avatarUrl?: string;
  accessToken?: string;
  lastSyncTime?: number;
}

export function getWebGithubCredentials(): WebGithubCredentials | null {
  try {
    const stored = localStorage.getItem(WEB_GITHUB_CREDS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveWebGithubCredentials(creds: WebGithubCredentials): void {
  localStorage.setItem(WEB_GITHUB_CREDS_KEY, JSON.stringify(creds));
}

export function clearWebGithubCredentials(): void {
  localStorage.removeItem(WEB_GITHUB_CREDS_KEY);
}

export function requireAccessToken(): string {
  const token = getWebGithubCredentials()?.accessToken;
  if (!token) {
    throw new Error('Not connected to GitHub');
  }
  return token;
}
