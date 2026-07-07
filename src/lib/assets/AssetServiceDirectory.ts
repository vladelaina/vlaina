import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getMimeType, processFilename } from './core/naming';
import { normalizeContainedAssetPath } from './core/pathContainment';
import { resolveAssetTarget } from './AssetServicePaths';
import type { AssetEntry } from './types';
import type { AssetConfig, AssetContext } from './AssetServiceTypes';

export const MAX_ASSET_LIST_DIRECTORY_ENTRIES = 5000;
export const MAX_ASSET_METADATA_STAT_CONCURRENCY = 8;
const ASSET_DIRECTORY_ENTRY_PRIORITY_BUCKETS = 3;
const UNSAFE_ASSET_ENTRY_NAME_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export interface NormalizedAssetDirectoryEntry {
  name: string;
  path: string;
  size?: number;
  modifiedAt?: number;
}

export function getKnownAssetSize(size: number | null | undefined): number | undefined {
  return typeof size === 'number' && Number.isFinite(size) && size >= 0
    ? size
    : undefined;
}

export function getKnownAssetModifiedAt(modifiedAt: number | null | undefined): number | undefined {
  return typeof modifiedAt === 'number' && Number.isFinite(modifiedAt)
    ? modifiedAt
    : undefined;
}

export function getOriginalStoredFilename(fileName: string): string {
  return processFilename(fileName, new Set());
}

export function isSameAssetName(entryName: string, fileName: string): boolean {
  return entryName.toLowerCase() === getOriginalStoredFilename(fileName).toLowerCase();
}

function isSafeAssetEntryName(name: string): boolean {
  return Boolean(name)
    && name !== '.'
    && name !== '..'
    && !/[\\/]/.test(name)
    && !UNSAFE_ASSET_ENTRY_NAME_CHARS.test(name);
}

function isSameNormalizedPath(leftPath: string, rightPath: string): boolean {
  return (
    normalizeContainedAssetPath(leftPath, rightPath) !== null &&
    normalizeContainedAssetPath(rightPath, leftPath) !== null
  );
}

async function normalizeAssetDirectoryEntry(
  targetDir: string,
  entry: { name: string; path: string; isFile: boolean; size?: number; modifiedAt?: number },
): Promise<NormalizedAssetDirectoryEntry | null> {
  if (!entry.isFile || !isSafeAssetEntryName(entry.name)) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(entry.path, targetDir);
  const expectedPath = normalizeContainedAssetPath(await joinPath(targetDir, entry.name), targetDir);
  if (!containedPath || !expectedPath || !isSameNormalizedPath(containedPath, expectedPath)) {
    return null;
  }

  return {
    name: entry.name,
    path: containedPath,
    size: getKnownAssetSize(entry.size),
    modifiedAt: getKnownAssetModifiedAt(entry.modifiedAt),
  };
}

export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function hydrateAssetEntryMetadata(
  storage: ReturnType<typeof getStorageAdapter>,
  entries: NormalizedAssetDirectoryEntry[],
  options: { forceStat?: boolean } = {},
) {
  return mapWithConcurrencyLimit(entries, MAX_ASSET_METADATA_STAT_CONCURRENCY, async (entry) => {
    const entrySize = getKnownAssetSize(entry.size);
    const entryModifiedAt = getKnownAssetModifiedAt(entry.modifiedAt);
    if (!options.forceStat && entrySize !== undefined && entryModifiedAt !== undefined) {
      return entry;
    }

    const info = await storage.stat(entry.path).catch(() => null);
    const infoSize = getKnownAssetSize(info?.size);
    const infoModifiedAt = getKnownAssetModifiedAt(info?.modifiedAt);
    return {
      ...entry,
      size: options.forceStat ? infoSize : entrySize ?? infoSize,
      modifiedAt: options.forceStat ? infoModifiedAt : entryModifiedAt ?? infoModifiedAt,
    };
  });
}

export async function normalizeAssetDirectoryEntries(
  targetDir: string,
  entries: Array<{ name: string; path: string; isFile: boolean; size?: number; modifiedAt?: number }>,
): Promise<NormalizedAssetDirectoryEntry[]> {
  const normalizedEntries: NormalizedAssetDirectoryEntry[] = [];
  for (const entry of entries) {
    const normalizedEntry = await normalizeAssetDirectoryEntry(targetDir, entry);
    if (normalizedEntry) {
      normalizedEntries.push(normalizedEntry);
    }
  }
  return normalizedEntries;
}

export function isImageAssetDirectoryEntry(entry: NormalizedAssetDirectoryEntry): boolean {
  return getMimeType(entry.name).startsWith('image/');
}

function getAssetDirectoryEntryPriority(
  entry: NormalizedAssetDirectoryEntry,
  uploadFilename?: string,
): number {
  if (uploadFilename && isSameAssetName(entry.name, uploadFilename)) {
    return 0;
  }

  return isImageAssetDirectoryEntry(entry) ? 1 : 2;
}

export function selectAssetDirectoryEntries(
  entries: NormalizedAssetDirectoryEntry[],
  uploadFilename?: string,
): NormalizedAssetDirectoryEntry[] {
  const buckets = Array.from(
    { length: ASSET_DIRECTORY_ENTRY_PRIORITY_BUCKETS },
    () => [] as NormalizedAssetDirectoryEntry[],
  );
  for (const entry of entries) {
    buckets[getAssetDirectoryEntryPriority(entry, uploadFilename)]?.push(entry);
  }
  return buckets.flat().slice(0, MAX_ASSET_LIST_DIRECTORY_ENTRIES);
}

export async function listAssets(
  context: AssetContext,
  config: AssetConfig
): Promise<AssetEntry[]> {
  const { targetDir, storedPathPrefix } = await resolveAssetTarget(context, config);
  const storage = getStorageAdapter();

  if (!await storage.exists(targetDir)) {
    return [];
  }

  const normalizedEntries = await normalizeAssetDirectoryEntries(targetDir, await storage.listDir(targetDir));
  const entries = selectAssetDirectoryEntries(normalizedEntries);
  const imageFiles = entries.filter(isImageAssetDirectoryEntry);

  const assets = imageFiles.map((entry): AssetEntry => ({
    filename: storedPathPrefix + entry.name,
    hash: '',
    size: entry.size ?? 0,
    mimeType: getMimeType(entry.name),
    uploadedAt: entry.modifiedAt ? new Date(entry.modifiedAt).toISOString() : '',
  }));

  return assets.sort((a, b) => b.filename.localeCompare(a.filename));
}
