import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getBaseName, getParentPath, isAbsolutePath, normalizePath } from '@/lib/storage/adapter';
import type { StarredEntry, StarredKind } from '../types';
import { createStarredEntry, getStarredEntryKey } from './registry';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  getStarredVaultPathComparisonKey,
  isValidStarredVaultPath,
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
  resolveStarredRelativePathForVault,
} from './pathUtils';

export interface StarredNoteContext {
  vaultPath: string;
  relativePath: string;
}

export function getStarredEntryAbsolutePath(entry: StarredEntry): string | null {
  const vaultPath = normalizeStarredVaultPath(entry.vaultPath);
  if (!isValidStarredVaultPath(vaultPath)) {
    return null;
  }

  const relativePath = normalizeStarredRelativePath(entry.relativePath);
  if (!relativePath) {
    return null;
  }

  return vaultPath.endsWith('/')
    ? `${vaultPath}${relativePath}`
    : `${vaultPath}/${relativePath}`;
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

  const vaultPath = getParentPath(path);
  const relativePath = getBaseName(path);
  if (!vaultPath || !relativePath) {
    return null;
  }

  return createStarredEntry('note', vaultPath, relativePath);
}

export function getStarredNoteDisplayPath(
  entry: StarredEntry,
  isCurrentVaultEntry: boolean,
): string | undefined {
  if (entry.kind !== 'note') {
    return undefined;
  }

  return isCurrentVaultEntry
    ? entry.relativePath
    : getStarredEntryAbsolutePath(entry) ?? undefined;
}

export function isStarredEntryForPath(
  entry: StarredEntry,
  kind: StarredKind,
  path: string,
  currentVaultPath: string,
): boolean {
  if (entry.kind !== kind) {
    return false;
  }

  const relativePath = currentVaultPath
    ? resolveStarredRelativePathForVault(path, currentVaultPath)
    : null;

  if (relativePath) {
    const key = getStarredEntryKey({ kind, vaultPath: currentVaultPath, relativePath });
    if (getStarredEntryKey(entry) === key) {
      return true;
    }
  }

  if (!isAbsolutePath(path)) {
    return false;
  }

  return getStarredVaultPathComparisonKey(getStarredEntryAbsolutePath(entry) ?? '') ===
    getStarredVaultPathComparisonKey(path);
}

export function findStarredEntryByPath(
  entries: StarredEntry[],
  kind: StarredKind,
  path: string,
  currentVaultPath: string,
): StarredEntry | undefined {
  return entries.find((entry) => isStarredEntryForPath(entry, kind, path, currentVaultPath));
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

    if (getStarredVaultPathComparisonKey(absoluteNotePath) === getStarredVaultPathComparisonKey(normalizedNote)) {
      const relativePath = normalizeNotePathKey(entry.relativePath);
      if (!relativePath) {
        continue;
      }

      return {
        vaultPath: normalizeStarredVaultPath(entry.vaultPath),
        relativePath,
      };
    }
  }

  return null;
}
