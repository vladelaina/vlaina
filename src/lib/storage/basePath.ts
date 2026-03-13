import { getStorageAdapter } from './adapter';

let cachedBasePath: string | null = null;

function trimTrailingSeparator(path: string): string {
  return path.endsWith('\\') || path.endsWith('/') ? path.slice(0, -1) : path;
}

export async function getStorageBasePath(): Promise<string> {
  if (cachedBasePath === null) {
    const storage = getStorageAdapter();
    cachedBasePath = trimTrailingSeparator(await storage.getBasePath());
  }
  return cachedBasePath;
}
