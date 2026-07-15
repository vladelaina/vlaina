import type { FileInfo, ListOptions } from './types';
import { MAX_WEB_ADAPTER_LIST_ENTRIES } from './webAdapterConstants';
import { createStoredFileInfo } from './webAdapterFiles';
import { prioritizeListEntries } from './webAdapterListing';
import type { StoredDir, StoredFile } from './webAdapterTypes';

export function buildWebAdapterListDirEntries({
  normalizedPath,
  files,
  dirs,
  options,
}: {
  normalizedPath: string;
  files: StoredFile[];
  dirs: StoredDir[];
  options?: ListOptions;
}): FileInfo[] {
  const results: FileInfo[] = [];
  const seenPaths = new Set<string>();
  const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;

  const addEntry = (entry: FileInfo) => {
    if (seenPaths.has(entry.path)) return;
    seenPaths.add(entry.path);
    results.push(entry);
  };

  const isHiddenPath = (parts: string[]) => !options?.includeHidden && parts.some((part) => part.startsWith('.'));

  const addImplicitDirectories = (parts: string[]) => {
    let currentPath = normalizedPath === '/' ? '' : normalizedPath;
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      addEntry({
        name: part,
        path: currentPath,
        isDirectory: true,
        isFile: false,
      });
    }
  };

  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;

    const relativePath = file.path.slice(prefix.length);
    const parts = relativePath.split('/');

    if (isHiddenPath(parts)) continue;

    if (parts.length === 1) {
      addEntry(createStoredFileInfo(file));
      continue;
    }

    if (options?.recursive) {
      addImplicitDirectories(parts.slice(0, -1));
      addEntry(createStoredFileInfo(file));
    } else {
      addEntry({
        name: parts[0],
        path: normalizedPath === '/' ? `/${parts[0]}` : `${normalizedPath}/${parts[0]}`,
        isDirectory: true,
        isFile: false,
      });
    }
  }

  for (const dir of dirs) {
    if (!dir.path.startsWith(prefix)) continue;

    const relativePath = dir.path.slice(prefix.length);
    const parts = relativePath.split('/');

    if (isHiddenPath(parts)) continue;

    if (parts.length === 1) {
      addEntry({
        name: dir.path.split('/').pop() || '',
        path: dir.path,
        isDirectory: true,
        isFile: false,
      });
      continue;
    }

    if (options?.recursive) {
      addImplicitDirectories(parts);
    } else {
      addEntry({
        name: parts[0],
        path: normalizedPath === '/' ? `/${parts[0]}` : `${normalizedPath}/${parts[0]}`,
        isDirectory: true,
        isFile: false,
      });
    }
  }

  const requestedLimit = options?.maxEntries;
  const resultLimit = typeof requestedLimit === 'number' && Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_WEB_ADAPTER_LIST_ENTRIES)
    : MAX_WEB_ADAPTER_LIST_ENTRIES;

  if (results.length <= resultLimit) {
    return results;
  }

  return prioritizeListEntries(results).slice(0, resultLimit);
}
