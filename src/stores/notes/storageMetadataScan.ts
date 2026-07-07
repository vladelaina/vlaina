import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isSafeNotesRootPathSegment, MAX_NOTES_ROOT_RELATIVE_PATH_CHARS } from './utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';

export const MAX_METADATA_READ_BYTES = 5 * 1024 * 1024;
export const MAX_WORKSPACE_STATE_BYTES = 256 * 1024;
export const utf8Encoder = new TextEncoder();

const MAX_METADATA_SCAN_ENTRIES = 5000;
const MAX_METADATA_DIRECTORY_SCAN_ENTRIES = 10_000;
const MAX_METADATA_SCAN_DEPTH = 24;
const LOW_PRIORITY_METADATA_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

interface MetadataScanBudget {
  scannedEntries: number;
  visitedEntries: number;
}

function isLowPriorityMetadataDirectory(name: string) {
  return LOW_PRIORITY_METADATA_DIRECTORY_NAMES.has(name.toLowerCase());
}

function shouldHideMetadataDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

function getMetadataScanPriority(entry: { name: string; isDirectory?: boolean; isFile?: boolean }) {
  if (!isSafeNotesRootPathSegment(entry.name)) {
    return 3;
  }

  if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
    return 0;
  }

  if (entry.isDirectory === true && !isLowPriorityMetadataDirectory(entry.name)) {
    return 1;
  }

  if (entry.isDirectory === true) {
    return 2;
  }

  return 3;
}

function prioritizeMetadataScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  maxEntries = entries.length,
): T[] {
  const priorityBuckets: T[][] = [[], [], [], []];
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  let retainedEntries = 0;
  for (const entry of entries) {
    const priority = getMetadataScanPriority(entry);
    const bucket = priorityBuckets[priority];
    if (!bucket) {
      continue;
    }

    if (retainedEntries < limit) {
      bucket.push(entry);
      retainedEntries += 1;
      continue;
    }

    for (let worsePriority = priorityBuckets.length - 1; worsePriority > priority; worsePriority -= 1) {
      const worseBucket = priorityBuckets[worsePriority];
      if (worseBucket.length > 0) {
        worseBucket.pop();
        bucket.push(entry);
        break;
      }
    }
  }
  const prioritized: T[] = [];
  for (const bucket of priorityBuckets) {
    for (const entry of bucket) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
}

export function isReadableBoundedFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  const size = fileInfo?.size;
  return (
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    (
      typeof size !== 'number' ||
      (Number.isFinite(size) && size >= 0 && size <= maxBytes)
    )
  );
}

export function isReadableBoundedMarkdownFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  if (!fileInfo || fileInfo.isDirectory === true || fileInfo.isFile === false) {
    return false;
  }

  const size = fileInfo.size;
  return typeof size !== 'number' || (Number.isFinite(size) && size >= 0 && size <= maxBytes);
}

export function getKnownReadableFileSize(
  fileInfo: { size?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

export function getKnownReadableModifiedAt(
  fileInfo: { modifiedAt?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

export function getKnownReadableCreatedAt(
  fileInfo: { createdAt?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.createdAt === 'number' && Number.isFinite(fileInfo.createdAt)
    ? fileInfo.createdAt
    : null;
}

export async function collectMarkdownPaths(
  basePath: string,
  relativePath: string = '',
  budget: MetadataScanBudget = { scannedEntries: 0, visitedEntries: 0 },
  depth = 0,
): Promise<string[]> {
  if (
    budget.scannedEntries >= MAX_METADATA_DIRECTORY_SCAN_ENTRIES ||
    budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES
  ) {
    return [];
  }

  const storage = getStorageAdapter();
  const currentPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  let entries: Awaited<ReturnType<typeof storage.listDir>>;
  try {
    entries = await storage.listDir(currentPath, { includeHidden: true });
  } catch (error) {
    if (!relativePath) {
      throw error;
    }
    return [];
  }
  const collected: string[] = [];

  const remainingScanEntries = MAX_METADATA_DIRECTORY_SCAN_ENTRIES - budget.scannedEntries;
  for (const entry of prioritizeMetadataScanEntries(entries, remainingScanEntries)) {
    if (budget.scannedEntries >= MAX_METADATA_DIRECTORY_SCAN_ENTRIES) {
      break;
    }
    budget.scannedEntries += 1;

    if (!isSafeNotesRootPathSegment(entry.name)) {
      continue;
    }

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entryPath.length > MAX_NOTES_ROOT_RELATIVE_PATH_CHARS) {
      continue;
    }

    if (entry.isDirectory === true) {
      if (shouldHideMetadataDirectory(entry.name) || depth >= MAX_METADATA_SCAN_DEPTH) {
        continue;
      }
      if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      collected.push(...await collectMarkdownPaths(basePath, entryPath, budget, depth + 1));
      continue;
    }

    if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
      if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      collected.push(entryPath);
    }
  }

  return collected;
}
