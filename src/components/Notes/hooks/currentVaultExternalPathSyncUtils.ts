import { getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { APP_CONFIG_FOLDER, STORE_FOLDER } from '@/stores/notes/constants';
import { normalizeFsPath } from './notesExternalSyncUtils';

const CONFIG_FILE_NAME = 'config.json';

export function isDirectChildPath(parentPath: string, absolutePath: string) {
  return getParentPath(absolutePath) === parentPath;
}

export async function looksLikeVaultRoot(path: string) {
  return (await readVaultConfigSignature(path)) !== null;
}

export function getVaultExternalWatchPaths(vaultPath: string): {
  normalizedVaultPath: string;
  watchParentPath: string;
  normalizedParentPath: string;
} | null {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const watchParentPath = getParentPath(vaultPath);
  const normalizedParentPath = watchParentPath ? normalizeFsPath(watchParentPath) : null;
  if (!watchParentPath || !normalizedParentPath) {
    return null;
  }

  return {
    normalizedVaultPath,
    watchParentPath,
    normalizedParentPath,
  };
}

export async function readVaultConfigSignature(vaultPath: string): Promise<string | null> {
  const storage = getStorageAdapter();
  const configPath = await joinPath(vaultPath, APP_CONFIG_FOLDER, STORE_FOLDER, CONFIG_FILE_NAME);
  if (!(await storage.exists(configPath))) {
    return null;
  }

  try {
    const signature = await storage.readFile(configPath);
    return signature;
  } catch {
    return null;
  }
}

export async function findRenamedVaultPathBySignature(
  parentPath: string,
  currentVaultPath: string,
  signature: string | null
): Promise<string | null> {
  if (!signature) {
    return null;
  }

  const storage = getStorageAdapter();
  if (await storage.exists(currentVaultPath)) {
    return null;
  }

  const normalizedCurrentVaultPath = normalizeFsPath(currentVaultPath);
  const entries = await storage.listDir(parentPath);

  for (const entry of entries) {
    if (!entry.isDirectory) {
      continue;
    }

    const candidatePath = await joinPath(parentPath, entry.name);
    if (normalizeFsPath(candidatePath) === normalizedCurrentVaultPath) {
      continue;
    }

    const candidateSignature = await readVaultConfigSignature(candidatePath);
    if (candidateSignature === signature) {
      return candidatePath;
    }
  }

  return null;
}
