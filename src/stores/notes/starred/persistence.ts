import { createPersistenceQueue } from '@/lib/storage/persistenceEngine';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { emitStorageAutoSyncEvent } from '@/lib/storage/storageAutoSync';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { STARRED_FILE } from '../constants';
import type { StarredEntry } from '../types';
import {
  CURRENT_STARRED_VERSION,
  dedupeStarredEntries,
  getStarredEntryKey,
  normalizeStarredEntry,
  type StarredRegistry,
} from './registry';
import {
  getStarredNotesRootPathComparisonKey,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
} from './pathUtils';
import { pruneInvalidStarredEntries } from './prune';

const MAX_STARRED_ENTRIES = 5000;
const MAX_STARRED_ENTRY_SCAN_ITEMS = 20_000;
const MAX_STARRED_REGISTRY_BYTES = 5 * 1024 * 1024;
const MAX_DELETED_ENTRY_KEYS = MAX_STARRED_ENTRIES;
const MAX_DELETED_ENTRY_KEY_SCAN_ITEMS = 20_000;
const MAX_DELETED_ENTRY_KEY_CHARS = 4096;
const STARRED_PRUNE_IDLE_DELAY_MS = 1000;
const starredRegistryUtf8Encoder = new TextEncoder();
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

interface StarredSavePayload {
  entries: StarredEntry[];
  deletedEntryKeys: string[];
}

async function getStarredRegistryPath(): Promise<string> {
  await ensureDirectories();
  const { notes } = await getPaths();
  return joinPath(notes, STARRED_FILE);
}

function normalizeDeletedEntryKey(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_DELETED_ENTRY_KEY_CHARS ||
    CONTROL_OR_BIDI_PATTERN.test(value) ||
    (!value.startsWith('note::') && !value.startsWith('folder::'))
  ) {
    return null;
  }

  const kind = value.startsWith('note::') ? 'note' : 'folder';
  const prefixLength = kind === 'note' ? 6 : 8;
  const separatorIndex = value.indexOf('::', prefixLength);
  if (separatorIndex === -1) {
    return null;
  }

  const notesRootPath = value.slice(prefixLength, separatorIndex);
  const relativePath = value.slice(separatorIndex + 2);
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    return null;
  }

  const normalizedRelativePath = normalizeStarredRelativePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }
  if (kind === 'note' && !isSupportedMarkdownPath(normalizedRelativePath)) {
    return null;
  }

  return `${kind}::${getStarredNotesRootPathComparisonKey(notesRootPath)}::${normalizedRelativePath}`;
}

function normalizeDeletedEntryKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_DELETED_ENTRY_KEY_SCAN_ITEMS);
  for (let index = 0; index < scanLimit && normalized.length < MAX_DELETED_ENTRY_KEYS; index += 1) {
    const item = value[index];
    const key = normalizeDeletedEntryKey(item);
    if (!key || seen.has(key)) {
      continue;
    }

    normalized.push(key);
    seen.add(key);
  }
  return normalized;
}

function normalizeStarredEntriesForPersistence(entries: StarredEntry[]): StarredEntry[] {
  const normalizedEntries: StarredEntry[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(entries.length, MAX_STARRED_ENTRY_SCAN_ITEMS);

  for (let index = 0; index < scanLimit && normalizedEntries.length < MAX_STARRED_ENTRIES; index += 1) {
    const entry = normalizeStarredEntry(entries[index]);
    if (!entry) {
      continue;
    }

    const key = getStarredEntryKey(entry);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedEntries.push(entry);
  }

  return normalizedEntries;
}

function parseStarredRegistryPayload(value: unknown): StarredRegistry {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const entries = Array.isArray(data.entries)
    ? normalizeStarredEntriesForPersistence(data.entries as StarredEntry[])
    : [];

  return {
    version: CURRENT_STARRED_VERSION,
    entries,
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
    starredInfo?.isDirectory === true ||
    starredInfo?.isFile === false ||
    (typeof starredInfo?.size === 'number' && (
      !Number.isFinite(starredInfo.size) ||
      starredInfo.size < 0 ||
      starredInfo.size > MAX_STARRED_REGISTRY_BYTES
    ))
  ) {
    return { version: CURRENT_STARRED_VERSION, entries: [], deletedEntryKeys: [] };
  }

  const content = await storage.readFile(starredPath, MAX_STARRED_REGISTRY_BYTES);
  if (starredRegistryUtf8Encoder.encode(content).length > MAX_STARRED_REGISTRY_BYTES) {
    return { version: CURRENT_STARRED_VERSION, entries: [], deletedEntryKeys: [] };
  }

  return parseStarredRegistryPayload(JSON.parse(content));
}

function mergeStarredEntriesForSave(
  incomingEntries: StarredEntry[],
  existingRegistry: StarredRegistry | null,
  deletedEntryKeys: string[],
): StarredRegistry {
  const deletedKeys = new Set(normalizeDeletedEntryKeys([
    ...deletedEntryKeys,
    ...(existingRegistry?.deletedEntryKeys || []),
  ]));
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

const starredPersistenceQueue = createPersistenceQueue<StarredSavePayload>({
  write: writeStarredRegistry,
  debounceMs: 80,
  maxWaitMs: 400,
  onError: (_error) => {
  },
});

let lifecycleRegistered = false;
let pendingStarredPruneTimer: ReturnType<typeof setTimeout> | null = null;
let latestStarredPruneRequestId = 0;

function scheduleStarredRegistryPrune(
  registry: StarredRegistry,
  dedupedEntries: StarredEntry[],
): void {
  const requestId = ++latestStarredPruneRequestId;
  if (pendingStarredPruneTimer !== null) {
    clearTimeout(pendingStarredPruneTimer);
    pendingStarredPruneTimer = null;
  }

  pendingStarredPruneTimer = setTimeout(() => {
    pendingStarredPruneTimer = null;
    void (async () => {
      const prunedRegistry = await pruneInvalidStarredEntries(dedupedEntries);
      if (requestId !== latestStarredPruneRequestId || !prunedRegistry.changed) {
        return;
      }

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
    })().catch(() => undefined);
  }, STARRED_PRUNE_IDLE_DELAY_MS);
}

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
    scheduleStarredRegistryPrune(registry, dedupedEntries);

    return {
      version: CURRENT_STARRED_VERSION,
      entries: dedupedEntries,
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
    entries: normalizeStarredEntriesForPersistence(entries),
    deletedEntryKeys: normalizeStarredEntriesForPersistence(options.deletedEntries || []).map(getStarredEntryKey),
  });
}

export async function flushStarredRegistry(): Promise<void> {
  await starredPersistenceQueue.flush();
}
