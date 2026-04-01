import { createPersistenceQueue } from '@/lib/storage/persistenceEngine';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { STARRED_FILE } from '../constants';
import type { StarredEntry } from '../types';
import {
  CURRENT_STARRED_VERSION,
  dedupeStarredEntries,
  normalizeStarredEntry,
  type StarredRegistry,
} from './registry';

async function getStarredRegistryPath(): Promise<string> {
  await ensureDirectories();
  const { store } = await getPaths();
  return joinPath(store, STARRED_FILE);
}

async function writeStarredRegistry(entries: StarredEntry[]): Promise<void> {
  const storage = getStorageAdapter();
  const starredPath = await getStarredRegistryPath();
  const registry: StarredRegistry = {
    version: CURRENT_STARRED_VERSION,
    entries: dedupeStarredEntries(entries),
  };
  await storage.writeFile(starredPath, JSON.stringify(registry, null, 2));
}

async function isStarredEntryValid(entry: StarredEntry): Promise<boolean> {
  const storage = getStorageAdapter();

  const vaultExists = await storage.exists(entry.vaultPath);
  if (!vaultExists) {
    return false;
  }

  const vaultInfo = await storage.stat(entry.vaultPath);
  if (vaultInfo?.isDirectory === false) {
    return false;
  }

  const fullPath = await joinPath(entry.vaultPath, entry.relativePath);
  const targetExists = await storage.exists(fullPath);
  if (!targetExists) {
    return false;
  }

  const targetInfo = await storage.stat(fullPath);
  if (!targetInfo) {
    return true;
  }

  return entry.kind === 'folder'
    ? targetInfo.isDirectory !== false
    : targetInfo.isFile !== false;
}

async function pruneInvalidStarredEntries(entries: StarredEntry[]): Promise<{
  entries: StarredEntry[];
  changed: boolean;
}> {
  if (entries.length === 0) {
    return { entries, changed: false };
  }

  const validEntries: StarredEntry[] = [];
  const batchSize = 12;

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (entry) => ({
        entry,
        valid: await isStarredEntryValid(entry),
      }))
    );

    results.forEach((result) => {
      if (result.valid) {
        validEntries.push(result.entry);
      }
    });
  }

  const dedupedEntries = dedupeStarredEntries(validEntries);
  const changed = dedupedEntries.length !== entries.length;

  return {
    entries: dedupedEntries,
    changed,
  };
}

const starredPersistenceQueue = createPersistenceQueue<StarredEntry[]>({
  write: writeStarredRegistry,
  debounceMs: 80,
  maxWaitMs: 400,
  onError: (error) => {
    console.error('[NotesStarred] Failed to persist starred registry:', error);
  },
});

let lifecycleRegistered = false;

function registerPersistenceLifecycle(): void {
  if (lifecycleRegistered || typeof window === 'undefined') {
    return;
  }

  lifecycleRegistered = true;

  const flushInBackground = () => {
    if (!starredPersistenceQueue.hasPending()) return;
    void starredPersistenceQueue.flush();
  };

  window.addEventListener('pagehide', flushInBackground);
  window.addEventListener('beforeunload', flushInBackground);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushInBackground();
    }
  });
}

registerPersistenceLifecycle();

export async function loadStarredRegistry(): Promise<StarredRegistry> {
  try {
    const storage = getStorageAdapter();
    const starredPath = await getStarredRegistryPath();

    if (!(await storage.exists(starredPath))) {
      return { version: CURRENT_STARRED_VERSION, entries: [] };
    }

    const content = await storage.readFile(starredPath);
    const data = JSON.parse(content);
    const entries = Array.isArray(data.entries)
      ? data.entries
          .map((entry: unknown) => normalizeStarredEntry(entry))
          .filter((entry: StarredEntry | null): entry is StarredEntry => entry !== null)
      : [];
    const dedupedEntries = dedupeStarredEntries(entries);
    const prunedRegistry = await pruneInvalidStarredEntries(dedupedEntries);

    if (prunedRegistry.changed) {
      await starredPersistenceQueue.saveNow(prunedRegistry.entries);
    }

    return {
      version: CURRENT_STARRED_VERSION,
      entries: prunedRegistry.entries,
    };
  } catch (error) {
    console.error('[NotesStorage] Failed to load starred registry:', error);
    return { version: CURRENT_STARRED_VERSION, entries: [] };
  }
}

export function saveStarredRegistry(entries: StarredEntry[]): void {
  starredPersistenceQueue.schedule(dedupeStarredEntries(entries));
}

export async function flushStarredRegistry(): Promise<void> {
  await starredPersistenceQueue.flush();
}
