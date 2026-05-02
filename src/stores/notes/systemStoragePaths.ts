import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getPaths } from '@/lib/storage/paths';

function hashVaultPath(path: string): string {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getVaultStorageKey(vaultPath: string): string {
  const normalized = normalizeNotePathKey(vaultPath) ?? vaultPath.replace(/\\/g, '/');
  return `vault-${hashVaultPath(normalized)}`;
}

export async function getNotesSystemStorePath(...segments: string[]): Promise<string> {
  const { store } = await getPaths();
  return joinPath(store, 'notes', ...segments);
}

export async function getVaultSystemStorePath(
  vaultPath: string,
  ...segments: string[]
): Promise<string> {
  return getNotesSystemStorePath('vaults', getVaultStorageKey(vaultPath), ...segments);
}

export async function ensureSystemDirectory(path: string): Promise<void> {
  const storage = getStorageAdapter();
  if (!(await storage.exists(path))) {
    await storage.mkdir(path, true);
  }
}

export async function moveVaultSystemStore(
  previousVaultPath: string,
  nextVaultPath: string
): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const previousPath = await getVaultSystemStorePath(previousVaultPath);
    const nextPath = await getVaultSystemStorePath(nextVaultPath);

    if (
      previousPath === nextPath ||
      !(await storage.exists(previousPath)) ||
      await storage.exists(nextPath)
    ) {
      return;
    }

    await ensureSystemDirectory(await getNotesSystemStorePath('vaults'));
    await storage.rename(previousPath, nextPath);
  } catch (error) {
    console.error('[NotesStorage] Failed to move vault system store:', error);
  }
}
