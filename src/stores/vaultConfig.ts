import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureSystemDirectory, getVaultSystemStorePath } from './notes/systemStoragePaths';

const CONFIG_FILE_NAME = 'config.json';
const MAX_VAULT_CONFIG_BYTES = 64 * 1024;

function createVaultConfig(vaultPath: string) {
  return {
    version: 1,
    created: Date.now(),
    vaultPath,
  };
}

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
  const storePath = await getVaultSystemStorePath(normalizedVaultPath);
  await ensureSystemDirectory(storePath);

  const configFilePath = await joinPath(storePath, CONFIG_FILE_NAME);
  if (!(await storage.exists(configFilePath))) {
    await storage.writeFile(
      configFilePath,
      JSON.stringify(createVaultConfig(normalizedVaultPath), null, 2)
    );
    return;
  }

  try {
    const fileInfo = await storage.stat(configFilePath).catch(() => null);
    if (fileInfo?.size && fileInfo.size > MAX_VAULT_CONFIG_BYTES) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify(createVaultConfig(normalizedVaultPath), null, 2)
      );
      return;
    }

    const parsed = JSON.parse(await storage.readFile(configFilePath));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify(createVaultConfig(normalizedVaultPath), null, 2)
      );
      return;
    }

    if (parsed.vaultPath !== normalizedVaultPath) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify({ ...parsed, vaultPath: normalizedVaultPath }, null, 2)
      );
    }
  } catch {
    await storage.writeFile(
      configFilePath,
      JSON.stringify(createVaultConfig(normalizedVaultPath), null, 2)
    );
  }
}
