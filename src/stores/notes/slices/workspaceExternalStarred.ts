import { getBaseName, getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import {
  dedupeStarredEntries,
  getStarredEntryAbsolutePath,
  getStarredNotesRootPathComparisonKey,
  normalizeStarredNotesRootPath,
  resolveStarredRelativePathForNotesRoot,
} from '../starred';
import type { StarredEntry } from '../types';

export function remapStarredEntriesForAbsoluteRename(
  entries: StarredEntry[],
  oldPath: string,
  newPath: string,
): { entries: StarredEntry[]; changed: boolean } {
  if (!isAbsolutePath(oldPath) || !isAbsolutePath(newPath)) {
    return { entries, changed: false };
  }

  let changed = false;

  const remapped = entries.flatMap((entry) => {
    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath) {
      return [entry];
    }

    const normalizedAbsolutePath = normalizeStarredNotesRootPath(absolutePath);
    const nextAbsolutePath = remapStarredAbsolutePathForRename(normalizedAbsolutePath, oldPath, newPath);
    if (nextAbsolutePath === normalizedAbsolutePath) {
      return [entry];
    }

    const relativePath = resolveStarredRelativePathForNotesRoot(nextAbsolutePath, entry.notesRootPath);
    if (relativePath) {
      changed = true;
      return [{ ...entry, relativePath }];
    }

    const parentPath = getParentPath(nextAbsolutePath);
    const baseName = getBaseName(nextAbsolutePath);
    if (!parentPath || !baseName) {
      changed = true;
      return [];
    }

    changed = true;
    return [{
      ...entry,
      notesRootPath: normalizeStarredNotesRootPath(parentPath),
      relativePath: baseName,
    }];
  });

  const deduped = dedupeStarredEntries(remapped);
  if (deduped.length !== remapped.length) {
    changed = true;
  }

  return { entries: deduped, changed };
}

function isStarredAbsolutePathWithin(path: string, basePath: string): boolean {
  const pathKey = getStarredNotesRootPathComparisonKey(path);
  const baseKey = getStarredNotesRootPathComparisonKey(basePath);
  const childPrefix = baseKey.endsWith('/') ? baseKey : `${baseKey}/`;
  return pathKey === baseKey || pathKey.startsWith(childPrefix);
}

function remapStarredAbsolutePathForRename(path: string, oldPath: string, newPath: string): string {
  if (!isStarredAbsolutePathWithin(path, oldPath)) {
    return path;
  }

  const normalizedPath = normalizeStarredNotesRootPath(path);
  const normalizedOldPath = normalizeStarredNotesRootPath(oldPath);
  const normalizedNewPath = normalizeStarredNotesRootPath(newPath);
  if (getStarredNotesRootPathComparisonKey(normalizedPath) === getStarredNotesRootPathComparisonKey(normalizedOldPath)) {
    return normalizedNewPath;
  }

  const suffix = normalizedPath.slice(normalizedOldPath.length);
  return normalizedNewPath.endsWith('/') || suffix.startsWith('/')
    ? `${normalizedNewPath}${suffix}`
    : `${normalizedNewPath}/${suffix}`;
}

function hasPreservedStarredAbsolutePath(
  preservedDeletedPaths: ReadonlySet<string>,
  path: string,
): boolean {
  const pathKey = getStarredNotesRootPathComparisonKey(path);
  for (const preservedPath of preservedDeletedPaths) {
    if (getStarredNotesRootPathComparisonKey(preservedPath) === pathKey) {
      return true;
    }
  }
  return false;
}

export function pruneStarredEntriesForAbsoluteDeletion(
  entries: StarredEntry[],
  deletedPath: string,
  preservedDeletedPaths: ReadonlySet<string>,
): { entries: StarredEntry[]; changed: boolean } {
  if (!isAbsolutePath(deletedPath)) {
    return { entries, changed: false };
  }

  const normalizedDeletedPath = normalizeStarredNotesRootPath(deletedPath);
  let changed = false;

  const pruned = entries.filter((entry) => {
    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath) {
      return true;
    }

    const normalizedAbsolutePath = normalizeStarredNotesRootPath(absolutePath);
    if (hasPreservedStarredAbsolutePath(preservedDeletedPaths, normalizedAbsolutePath)) {
      return true;
    }

    const shouldRemove = isStarredAbsolutePathWithin(normalizedAbsolutePath, normalizedDeletedPath);
    if (shouldRemove) {
      changed = true;
      return false;
    }

    return true;
  });

  return { entries: pruned, changed };
}
