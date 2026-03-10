import type { StarredEntry, StarredKind } from '../types';
import { normalizeStarredRelativePath, normalizeStarredVaultPath } from './pathUtils';

export const CURRENT_STARRED_VERSION = 1;

export interface StarredRegistry {
  version: number;
  entries: StarredEntry[];
}

function isStarredKind(value: unknown): value is StarredKind {
  return value === 'note' || value === 'folder';
}

export function normalizeStarredEntry(value: unknown): StarredEntry | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !isStarredKind(candidate.kind)) {
    return null;
  }

  if (typeof candidate.vaultPath !== 'string' || typeof candidate.relativePath !== 'string') {
    return null;
  }

  const relativePath = normalizeStarredRelativePath(candidate.relativePath);
  if (!relativePath) return null;

  return {
    id: candidate.id,
    kind: candidate.kind,
    vaultPath: normalizeStarredVaultPath(candidate.vaultPath),
    relativePath,
    addedAt:
      typeof candidate.addedAt === 'number' && Number.isFinite(candidate.addedAt)
        ? candidate.addedAt
        : Date.now(),
  };
}

export function createStarredEntry(
  kind: StarredKind,
  vaultPath: string,
  relativePath: string
): StarredEntry {
  const normalizedPath = normalizeStarredRelativePath(relativePath);
  if (!normalizedPath) {
    throw new Error('Starred entry path must be a valid note or folder path');
  }

  return {
    id: `starred_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    vaultPath: normalizeStarredVaultPath(vaultPath),
    relativePath: normalizedPath,
    addedAt: Date.now(),
  };
}

export function getStarredEntryKey(
  entry: Pick<StarredEntry, 'kind' | 'vaultPath' | 'relativePath'>
): string {
  return `${entry.kind}::${normalizeStarredVaultPath(entry.vaultPath)}::${entry.relativePath}`;
}

export function dedupeStarredEntries(entries: StarredEntry[]): StarredEntry[] {
  const seen = new Set<string>();
  const deduped: StarredEntry[] = [];

  for (const entry of entries) {
    const key = getStarredEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

export function getVaultStarredPaths(entries: StarredEntry[], vaultPath: string): {
  notes: string[];
  folders: string[];
} {
  const normalizedVaultPath = normalizeStarredVaultPath(vaultPath);
  const notes: string[] = [];
  const folders: string[] = [];

  for (const entry of entries) {
    if (normalizeStarredVaultPath(entry.vaultPath) !== normalizedVaultPath) continue;
    if (entry.kind === 'folder') {
      folders.push(entry.relativePath);
      continue;
    }
    notes.push(entry.relativePath);
  }

  return { notes, folders };
}

export function remapStarredEntriesForVault(
  entries: StarredEntry[],
  vaultPath: string,
  remapPath: (relativePath: string, kind: StarredKind) => string | null
): { entries: StarredEntry[]; changed: boolean } {
  const normalizedVaultPath = normalizeStarredVaultPath(vaultPath);
  let changed = false;

  const remapped = entries.flatMap((entry) => {
    if (normalizeStarredVaultPath(entry.vaultPath) !== normalizedVaultPath) {
      return [entry];
    }

    const nextPath = remapPath(entry.relativePath, entry.kind);
    if (nextPath === null) {
      changed = true;
      return [];
    }

    const normalizedPath = normalizeStarredRelativePath(nextPath);
    if (!normalizedPath) {
      changed = true;
      return [];
    }

    if (normalizedPath === entry.relativePath) {
      return [entry];
    }

    changed = true;
    return [{ ...entry, relativePath: normalizedPath }];
  });

  const deduped = dedupeStarredEntries(remapped);
  if (deduped.length !== remapped.length) {
    changed = true;
  }

  return { entries: deduped, changed };
}
