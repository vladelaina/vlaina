import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getBaseName, getParentPath, isAbsolutePath, normalizePath } from '@/lib/storage/adapter';
import type { StarredEntry, StarredKind } from '../types';
import { createStarredEntry, getStarredEntryKey } from './registry';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  getStarredNotesRootPathComparisonKey,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
  resolveStarredRelativePathForNotesRoot,
} from './pathUtils';

export interface StarredNoteContext {
  notesRootPath: string;
  relativePath: string;
}

export function getStarredEntryAbsolutePath(entry: StarredEntry): string | null {
  const notesRootPath = normalizeStarredNotesRootPath(entry.notesRootPath);
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    return null;
  }

  const relativePath = normalizeStarredRelativePath(entry.relativePath);
  if (!relativePath) {
    return null;
  }

  return notesRootPath.endsWith('/')
    ? `${notesRootPath}${relativePath}`
    : `${notesRootPath}/${relativePath}`;
}

export function createStarredEntryFromAbsoluteNotePath(path: string): StarredEntry | null {
  if (!isAbsolutePath(path)) {
    return null;
  }
  if (!isSupportedMarkdownPath(path)) {
    return null;
  }
  if (hasInternalNotePathSegment(path)) {
    return null;
  }

  const notesRootPath = getParentPath(path);
  const relativePath = getBaseName(path);
  if (!notesRootPath || !relativePath) {
    return null;
  }

  return createStarredEntry('note', notesRootPath, relativePath);
}

export function getStarredNoteDisplayPath(
  entry: StarredEntry,
  isCurrentNotesRootEntry: boolean,
): string | undefined {
  if (entry.kind !== 'note') {
    return undefined;
  }

  return isCurrentNotesRootEntry
    ? entry.relativePath
    : getStarredEntryAbsolutePath(entry) ?? undefined;
}

export function isStarredEntryForPath(
  entry: StarredEntry,
  kind: StarredKind,
  path: string,
  currentNotesRootPath: string,
): boolean {
  if (entry.kind !== kind) {
    return false;
  }

  const relativePath = currentNotesRootPath
    ? resolveStarredRelativePathForNotesRoot(path, currentNotesRootPath)
    : null;

  if (relativePath) {
    const key = getStarredEntryKey({ kind, notesRootPath: currentNotesRootPath, relativePath });
    if (getStarredEntryKey(entry) === key) {
      return true;
    }
  }

  if (!isAbsolutePath(path)) {
    return false;
  }

  return getStarredNotesRootPathComparisonKey(getStarredEntryAbsolutePath(entry) ?? '') ===
    getStarredNotesRootPathComparisonKey(path);
}

export function findStarredEntryByPath(
  entries: StarredEntry[],
  kind: StarredKind,
  path: string,
  currentNotesRootPath: string,
): StarredEntry | undefined {
  return entries.find((entry) => isStarredEntryForPath(entry, kind, path, currentNotesRootPath));
}

export function resolveStarredNoteContext(
  notePath: string,
  starredEntries: StarredEntry[],
): StarredNoteContext | null {
  const normalizedNote = normalizePath(notePath, true);

  for (const entry of starredEntries) {
    if (entry.kind !== 'note') {
      continue;
    }

    const absoluteNotePath = getStarredEntryAbsolutePath(entry);
    if (!absoluteNotePath) {
      continue;
    }

    if (getStarredNotesRootPathComparisonKey(absoluteNotePath) === getStarredNotesRootPathComparisonKey(normalizedNote)) {
      const relativePath = normalizeNotePathKey(entry.relativePath);
      if (!relativePath) {
        continue;
      }

      return {
        notesRootPath: normalizeStarredNotesRootPath(entry.notesRootPath),
        relativePath,
      };
    }
  }

  return null;
}
