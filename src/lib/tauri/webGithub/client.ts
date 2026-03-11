import { requireAccessToken } from './credentials';

export const API_BASE = 'https://api.nekotick.com';
export const GITHUB_API_BASE = 'https://api.github.com';

export async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
