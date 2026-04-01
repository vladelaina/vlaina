import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';

const APP_CONFIG_FOLDER = '.vlaina';
const STORE_FOLDER = 'store';

const DEFAULT_VAULT_CONFIG = {
  version: 1,
  created: Date.now(),
};

const DEFAULT_WORKSPACE_STATE = {
  lastOpenedFile: null,
};

export function normalizeVaultPath(path: string): string {
  const withForwardSlashes = path.replace(/\\/g, '/');

  if (withForwardSlashes === '/' || /^[a-zA-Z]:\/$/.test(withForwardSlashes)) {
    return withForwardSlashes;
  }

  const normalized = withForwardSlashes.replace(/\/+$/, '');
  return normalized || withForwardSlashes;
}

export async function ensureVaultConfig(vaultPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const normalizedVaultPath = normalizeVaultPath(vaultPath);
  const storePath = await joinPath(normalizedVaultPath, APP_CONFIG_FOLDER, STORE_FOLDER);

  if (!(await storage.exists(storePath))) {
    await storage.mkdir(storePath, true);
  }

  const configFilePath = await joinPath(storePath, 'config.json');
  if (!(await storage.exists(configFilePath))) {
    await storage.writeFile(configFilePath, JSON.stringify(DEFAULT_VAULT_CONFIG, null, 2));
  }

  const workspacePath = await joinPath(storePath, 'workspace.json');
  if (!(await storage.exists(workspacePath))) {
    await storage.writeFile(workspacePath, JSON.stringify(DEFAULT_WORKSPACE_STATE, null, 2));
  }
}
