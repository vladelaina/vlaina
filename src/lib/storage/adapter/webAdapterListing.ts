import type { FileInfo } from './types';
import {
  LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES,
  WEB_ADAPTER_LIST_PRIORITY_BUCKETS,
  WEB_ADAPTER_MARKDOWN_FILE_EXTENSION_PATTERN,
  WEB_ADAPTER_UNSAFE_LIST_ENTRY_NAME_PATTERN,
} from './webAdapterConstants';
import { getWebAdapterPathBaseName } from './webAdapterPath';
import type { StoredDir, StoredFile } from './webAdapterTypes';

export function isUnsafeListEntryName(name: string): boolean {
  return (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    WEB_ADAPTER_UNSAFE_LIST_ENTRY_NAME_PATTERN.test(name)
  );
}

function hasUnsafeListPathSegment(path: string): boolean {
  return path
    .split('/')
    .filter(Boolean)
    .some(isUnsafeListEntryName);
}

function getListEntryPriority(entry: FileInfo): number {
  if (isUnsafeListEntryName(entry.name)) {
    return 4;
  }

  if (entry.isFile && WEB_ADAPTER_MARKDOWN_FILE_EXTENSION_PATTERN.test(entry.name)) {
    return 0;
  }
  if (entry.isDirectory) {
    return LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES.has(entry.name.toLowerCase()) ? 2 : 1;
  }
  return 3;
}

export function prioritizeListEntries(entries: FileInfo[]): FileInfo[] {
  const buckets = Array.from(
    { length: WEB_ADAPTER_LIST_PRIORITY_BUCKETS },
    () => [] as FileInfo[],
  );
  for (const entry of entries) {
    buckets[getListEntryPriority(entry)]?.push(entry);
  }
  return buckets.flat();
}

export function getStoredFileListingScanPriority(file: StoredFile): number {
  if (hasUnsafeListPathSegment(file.path)) {
    return 4;
  }
  return WEB_ADAPTER_MARKDOWN_FILE_EXTENSION_PATTERN.test(getWebAdapterPathBaseName(file.path)) ? 0 : 3;
}

export function getStoredDirListingScanPriority(dir: StoredDir): number {
  const name = getWebAdapterPathBaseName(dir.path);
  if (hasUnsafeListPathSegment(dir.path)) {
    return 4;
  }
  return LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES.has(name.toLowerCase()) ? 2 : 1;
}

export function addPrioritizedPrefixEntry<T>(
  buckets: T[][],
  entry: T,
  priority: number,
  limit: number,
  selectedCount: number,
): number {
  const bucketIndex = Math.max(0, Math.min(buckets.length - 1, priority));
  buckets[bucketIndex].push(entry);
  let nextCount = selectedCount + 1;
  for (let index = buckets.length - 1; nextCount > limit && index >= 0; index -= 1) {
    const bucket = buckets[index];
    while (nextCount > limit && bucket.length > 0) {
      bucket.pop();
      nextCount -= 1;
    }
  }
  return nextCount;
}

export function flattenPrioritizedPrefixEntries<T>(buckets: T[][]): T[] {
  return buckets.flat();
}
