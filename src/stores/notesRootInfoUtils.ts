import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import { normalizeNotesRootPath } from './notesRootConfig';
import type { NotesRootInfo } from './notesRootStoreTypes';
import {
  MAX_DELETED_NOTES_ROOT_PATHS,
  MAX_NOTES_ROOT_ID_CHARS,
  MAX_NOTES_ROOT_NAME_CHARS,
  MAX_NOTES_ROOT_PATH_CHARS,
  MAX_RECENT_NOTES_ROOTS,
  MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS,
  NOTES_ROOTS_STORAGE_KEY,
  UNSAFE_NOTES_ROOT_PATH_CHARS,
} from './notesRootStoreConstants';

function generateNotesRootId(): string {
  return `notes-root-${crypto.randomUUID()}`;
}

export function getNotesRootName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function normalizeNotesRootTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

function isAbsoluteNotesRootPath(path: string): boolean {
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    /^\/\/[^/]+\/[^/]+/.test(path)
  );
}

export function normalizeSafeNotesRootPath(path: string): string | null {
  if (!path || path.length > MAX_NOTES_ROOT_PATH_CHARS || UNSAFE_NOTES_ROOT_PATH_CHARS.test(path)) {
    return null;
  }

  const normalizedPath = normalizeNotesRootPath(path);
  if (
    !normalizedPath ||
    normalizedPath.length > MAX_NOTES_ROOT_PATH_CHARS ||
    UNSAFE_NOTES_ROOT_PATH_CHARS.test(normalizedPath) ||
    !isAbsoluteNotesRootPath(normalizedPath)
  ) {
    return null;
  }

  return normalizedPath;
}

export function normalizeDeletedNotesRootPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) {
    return [];
  }

  const deletedNotesRootPaths: string[] = [];
  const seenPaths = new Set<string>();

  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const path = paths[index];
    if (typeof path !== 'string') {
      continue;
    }
    const normalizedPath = normalizeSafeNotesRootPath(path);
    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    deletedNotesRootPaths.push(normalizedPath);

    if (deletedNotesRootPaths.length >= MAX_DELETED_NOTES_ROOT_PATHS) {
      break;
    }
  }

  return deletedNotesRootPaths.reverse();
}

export function normalizeNotesRootInfo(notesRoot: NotesRootInfo): NotesRootInfo;
export function normalizeNotesRootInfo(notesRoot: unknown): NotesRootInfo | null;
export function normalizeNotesRootInfo(notesRoot: unknown): NotesRootInfo | null {
  if (!notesRoot || typeof notesRoot !== 'object') {
    return null;
  }

  const candidate = notesRoot as Partial<NotesRootInfo>;
  if (
    typeof candidate.path !== 'string' ||
    candidate.path.length === 0 ||
      candidate.path.length > MAX_NOTES_ROOT_PATH_CHARS
  ) {
    return null;
  }

  const normalizedPath = normalizeSafeNotesRootPath(candidate.path);
  if (!normalizedPath) {
    return null;
  }
  const id = typeof candidate.id === 'string' && candidate.id.length <= MAX_NOTES_ROOT_ID_CHARS
    ? candidate.id
    : generateNotesRootId();
  const name = typeof candidate.name === 'string' && candidate.name.length <= MAX_NOTES_ROOT_NAME_CHARS
    ? candidate.name
    : '';

  return {
    id,
    name: name || getNotesRootName(normalizedPath),
    path: normalizedPath,
    lastOpened: normalizeNotesRootTimestamp(candidate.lastOpened),
  };
}

export function normalizeRecentNotesRoots(notesRoots: unknown): NotesRootInfo[] {
  if (!Array.isArray(notesRoots)) {
    return [];
  }

  const seenPaths = new Set<string>();
  const normalizedNotesRoots: NotesRootInfo[] = [];

  for (const notesRoot of notesRoots) {
    const normalizedNotesRoot = normalizeNotesRootInfo(notesRoot);
    if (!normalizedNotesRoot || seenPaths.has(normalizedNotesRoot.path)) {
      continue;
    }

    seenPaths.add(normalizedNotesRoot.path);
    normalizedNotesRoots.push(normalizedNotesRoot);
  }

  return normalizedNotesRoots.slice(0, MAX_RECENT_NOTES_ROOTS);
}

export function tryParseRecentNotesRootsStorageValue(value: string | null): NotesRootInfo[] | null {
  if (!value || value.length > MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeRecentNotesRoots(parsed) : null;
  } catch {
    return null;
  }
}

export function parseRecentNotesRootsStorageValue(value: string | null): NotesRootInfo[] {
  return tryParseRecentNotesRootsStorageValue(value) ?? [];
}

export function isOversizedRecentNotesRootsStorageValue(value: string | null): boolean {
  return !!value && value.length > MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS;
}

export function loadRecentNotesRootsFromStorage(): NotesRootInfo[] {
  try {
    return parseRecentNotesRootsStorageValue(localStorage.getItem(NOTES_ROOTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function upsertRecentNotesRoot(recentNotesRoots: NotesRootInfo[], path: string, name?: string) {
  const normalizedPath = normalizeNotesRootPath(path);
  const notesRootName = name || getNotesRootName(normalizedPath);
  const existingNotesRoot = recentNotesRoots.find((candidate) => candidate.path === normalizedPath);

  const notesRoot = existingNotesRoot
    ? { ...existingNotesRoot, name: notesRootName, lastOpened: Date.now() }
    : {
        id: generateNotesRootId(),
        name: notesRootName,
        path: normalizedPath,
        lastOpened: Date.now(),
      };

  return {
    notesRoot,
    recentNotesRoots: normalizeRecentNotesRoots([
      notesRoot,
      ...recentNotesRoots.filter((candidate) => candidate.path !== normalizedPath),
    ]),
  };
}

export async function resolveRenamedNotesRootPath(currentPath: string, nextName: string) {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(currentPath);
  if (!parentPath) {
    throw new Error('Cannot rename the opened folder at this path');
  }

  const currentFolderName = getBaseName(currentPath);
  const desiredName = sanitizeFileName(nextName);
  const resolvedName = await resolveUniqueName(desiredName, async (candidateName) => {
    if (candidateName === currentFolderName) {
      return false;
    }

    const candidatePath = await joinPath(parentPath, candidateName);
    return storage.exists(candidatePath);
  });

  return {
    name: resolvedName,
    path: normalizeNotesRootPath(await joinPath(parentPath, resolvedName)),
  };
}

export function isNativeFilesystemPath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('~')) return true;
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}
