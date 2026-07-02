import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import type { StarredEntry, StarredKind } from '../types';
import {
  getStarredNotesRootPathComparisonKey,
  isSameStarredNotesRootPath,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
} from './pathUtils';

export const CURRENT_STARRED_VERSION = 1;

export interface StarredRegistry {
  version: number;
  entries: StarredEntry[];
  deletedEntryKeys?: string[];
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

  if (typeof candidate.notesRootPath !== 'string' || typeof candidate.relativePath !== 'string') {
    return null;
  }

  if (!isValidStarredNotesRootPath(candidate.notesRootPath)) {
    return null;
  }

  const relativePath = normalizeStarredRelativePath(candidate.relativePath);
  if (!relativePath) return null;
  if (candidate.kind === 'note' && !isSupportedMarkdownPath(relativePath)) {
    return null;
  }

  return {
    id: candidate.id,
    kind: candidate.kind,
    notesRootPath: normalizeStarredNotesRootPath(candidate.notesRootPath),
    relativePath,
    addedAt:
      typeof candidate.addedAt === 'number' && Number.isFinite(candidate.addedAt)
        ? candidate.addedAt
        : Date.now(),
  };
}

export function createStarredEntry(
  kind: StarredKind,
  notesRootPath: string,
  relativePath: string
): StarredEntry {
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    throw new Error('Starred entry opened folder path must be an absolute path');
  }

  const normalizedPath = normalizeStarredRelativePath(relativePath);
  if (!normalizedPath) {
    throw new Error('Starred entry path must be a valid note or folder path');
  }
  if (kind === 'note' && !isSupportedMarkdownPath(normalizedPath)) {
    throw new Error('Starred note path must be a supported Markdown file');
  }

  return {
    id: `starred-${crypto.randomUUID()}`,
    kind,
    notesRootPath: normalizeStarredNotesRootPath(notesRootPath),
    relativePath: normalizedPath,
    addedAt: Date.now(),
  };
}

export function createStarredEntryIfValid(
  kind: StarredKind,
  notesRootPath: string,
  relativePath: string
): StarredEntry | null {
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    return null;
  }

  const normalizedPath = normalizeStarredRelativePath(relativePath);
  if (!normalizedPath) {
    return null;
  }
  if (kind === 'note' && !isSupportedMarkdownPath(normalizedPath)) {
    return null;
  }

  return {
    id: `starred-${crypto.randomUUID()}`,
    kind,
    notesRootPath: normalizeStarredNotesRootPath(notesRootPath),
    relativePath: normalizedPath,
    addedAt: Date.now(),
  };
}

export function getStarredEntryKey(
  entry: Pick<StarredEntry, 'kind' | 'notesRootPath' | 'relativePath'>
): string {
  return `${entry.kind}::${getStarredNotesRootPathComparisonKey(entry.notesRootPath)}::${entry.relativePath}`;
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

export function getNotesRootStarredPaths(entries: StarredEntry[], notesRootPath: string): {
  notes: string[];
  folders: string[];
} {
  const notes: string[] = [];
  const folders: string[] = [];

  for (const entry of entries) {
    if (!isSameStarredNotesRootPath(entry.notesRootPath, notesRootPath)) continue;
    if (entry.kind === 'folder') {
      folders.push(entry.relativePath);
      continue;
    }
    notes.push(entry.relativePath);
  }

  return { notes, folders };
}

export function remapStarredEntriesForNotesRoot(
  entries: StarredEntry[],
  notesRootPath: string,
  remapPath: (relativePath: string, kind: StarredKind) => string | null
): { entries: StarredEntry[]; changed: boolean } {
  let changed = false;

  const remapped = entries.flatMap((entry) => {
    if (!isSameStarredNotesRootPath(entry.notesRootPath, notesRootPath)) {
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
    if (entry.kind === 'note' && !isSupportedMarkdownPath(normalizedPath)) {
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
