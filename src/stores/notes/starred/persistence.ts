import { createPersistenceQueue } from '@/lib/storage/persistenceEngine';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { emitStorageAutoSyncEvent } from '@/lib/storage/storageAutoSync';
import { STARRED_FILE } from '../constants';
import type { StarredEntry } from '../types';
import {
  CURRENT_STARRED_VERSION,
  dedupeStarredEntries,
  getStarredEntryKey,
  normalizeStarredEntry,
  type StarredRegistry,
} from './registry';

const MAX_STARRED_ENTRIES = 5000;
const MAX_STARRED_REGISTRY_BYTES = 5 * 1024 * 1024;

interface StarredSavePayload {
  entries: StarredEntry[];
  deletedEntryKeys: string[];
}

async function getStarredRegistryPath(): Promise<string> {
  await ensureDirectories();
  const { store } = await getPaths();
  return joinPath(store, STARRED_FILE);
}

function normalizeDeletedEntryKeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : [];
}

function parseStarredRegistryPayload(value: unknown): StarredRegistry {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const entries = Array.isArray(data.entries)
    ? data.entries
        .slice(0, MAX_STARRED_ENTRIES)
        .map((entry: unknown) => normalizeStarredEntry(entry))
        .filter((entry: StarredEntry | null): entry is StarredEntry => entry !== null)
    : [];

  return {
    version: CURRENT_STARRED_VERSION,
    entries: dedupeStarredEntries(entries),
    deletedEntryKeys: normalizeDeletedEntryKeys(data.deletedEntryKeys),
  };
}

async function readRawStarredRegistry(): Promise<StarredRegistry | null> {
  const storage = getStorageAdapter();
  const starredPath = await getStarredRegistryPath();

  if (!(await storage.exists(starredPath))) {
    return null;
  }

  const starredInfo = await storage.stat(starredPath).catch(() => null);
  if (
    typeof starredInfo?.size !== 'number' ||
    starredInfo.size > MAX_STARRED_REGISTRY_BYTES
  ) {
    return { version: CURRENT_STARRED_VERSION, entries: [], deletedEntryKeys: [] };
  }

  return parseStarredRegistryPayload(JSON.parse(await storage.readFile(starredPath)));
}

function mergeStarredEntriesForSave(
  incomingEntries: StarredEntry[],
  existingRegistry: StarredRegistry | null,
  deletedEntryKeys: string[],
): StarredRegistry {
  const deletedKeys = new Set([
    ...(existingRegistry?.deletedEntryKeys || []),
    ...deletedEntryKeys,
  ]);
  const merged = dedupeStarredEntries([
    ...incomingEntries,
    ...(existingRegistry?.entries || []),
  ]).filter((entry) => !deletedKeys.has(getStarredEntryKey(entry)));

  return {
    version: CURRENT_STARRED_VERSION,
    entries: merged.slice(0, MAX_STARRED_ENTRIES),
    deletedEntryKeys: Array.from(deletedKeys),
  };
}

async function writeStarredRegistry(payload: StarredSavePayload): Promise<void> {
  const storage = getStorageAdapter();
  const starredPath = await getStarredRegistryPath();
  const existingRegistry = await readRawStarredRegistry().catch(() => null);
  const registry = mergeStarredEntriesForSave(
    dedupeStarredEntries(payload.entries).slice(0, MAX_STARRED_ENTRIES),
    existingRegistry,
    payload.deletedEntryKeys,
  );
  await storage.writeFile(starredPath, JSON.stringify(registry, null, 2));
  emitStorageAutoSyncEvent({ kind: 'notes-starred' });
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

const starredPersistenceQueue = createPersistenceQueue<StarredSavePayload>({
  write: writeStarredRegistry,
  debounceMs: 80,
  maxWaitMs: 400,
  onError: (_error) => {
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
    const registry = await readRawStarredRegistry();
    if (!registry) {
      return { version: CURRENT_STARRED_VERSION, entries: [], deletedEntryKeys: [] };
    }

    const dedupedEntries = dedupeStarredEntries(registry.entries);
    const prunedRegistry = await pruneInvalidStarredEntries(dedupedEntries);

    if (prunedRegistry.changed) {
      const prunedKeys = new Set(prunedRegistry.entries.map(getStarredEntryKey));
      await starredPersistenceQueue.saveNow({
        entries: prunedRegistry.entries,
        deletedEntryKeys: [
          ...(registry.deletedEntryKeys || []),
          ...dedupedEntries
            .filter((entry) => !prunedKeys.has(getStarredEntryKey(entry)))
            .map(getStarredEntryKey),
        ],
      });
    }

    return {
      version: CURRENT_STARRED_VERSION,
      entries: prunedRegistry.entries,
      deletedEntryKeys: registry.deletedEntryKeys || [],
    };
  } catch (error) {
    return { version: CURRENT_STARRED_VERSION, entries: [], deletedEntryKeys: [] };
  }
}

export function saveStarredRegistry(
  entries: StarredEntry[],
  options: { deletedEntries?: StarredEntry[] } = {}
): void {
  starredPersistenceQueue.schedule({
    entries: dedupeStarredEntries(entries).slice(0, MAX_STARRED_ENTRIES),
    deletedEntryKeys: (options.deletedEntries || []).map(getStarredEntryKey),
  });
}

export async function flushStarredRegistry(): Promise<void> {
  await starredPersistenceQueue.flush();
}
