import type { NotesStore, StarredKind } from '../types';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { createStarredEntry, getStarredEntryKey, getVaultStarredPaths } from './registry';
import { loadStarredRegistry, saveStarredRegistry } from './persistence';
import {
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
  resolveStarredRelativePathForVault,
} from './pathUtils';

let starredLoadRequestId = 0;

function applyStarredState(
  set: (partial: Partial<NotesStore>) => void,
  entries: NotesStore['starredEntries'],
  vaultPath: string
) {
  const starredPaths = getVaultStarredPaths(entries, vaultPath);
  set({
    starredEntries: entries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
  });
}

function getStarredEntryAbsolutePath(entry: NotesStore['starredEntries'][number]): string | null {
  const vaultPath = normalizeStarredVaultPath(entry.vaultPath);
  const relativePath = normalizeStarredRelativePath(entry.relativePath);
  if (!relativePath) {
    return null;
  }

  return vaultPath === '/'
    ? `/${relativePath}`
    : `${vaultPath}/${relativePath}`.replace(/\/+/g, '/');
}

function isStarredEntryForPath(
  entry: NotesStore['starredEntries'][number],
  kind: StarredKind,
  path: string,
  currentVaultPath: string
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

  return getStarredEntryAbsolutePath(entry) === normalizeStarredVaultPath(path);
}

export function findStarredEntryByPath(
  entries: NotesStore['starredEntries'],
  kind: StarredKind,
  path: string,
  currentVaultPath: string
) {
  return entries.find((entry) => isStarredEntryForPath(entry, kind, path, currentVaultPath));
}

export async function loadStarredForVault(
  set: (partial: Partial<NotesStore>) => void,
  get: () => NotesStore,
  vaultPath: string
): Promise<void> {
  const requestId = ++starredLoadRequestId;
  applyStarredState(set, get().starredEntries, vaultPath);
  set({ starredLoaded: false });
  const data = await loadStarredRegistry();
  if (requestId !== starredLoadRequestId) {
    return;
  }

  applyStarredState(set, data.entries, vaultPath);
  set({ starredLoaded: true });
}

export function toggleStarredEntry(
  set: (partial: Partial<NotesStore>) => void,
  get: () => NotesStore,
  kind: StarredKind,
  path: string
): void {
  const { notesPath, starredEntries } = get();
  if (findStarredEntryByPath(starredEntries, kind, path, notesPath)) {
    const updatedEntries = starredEntries.filter(
      (entry) => !isStarredEntryForPath(entry, kind, path, notesPath),
    );
    if (notesPath) {
      applyStarredState(set, updatedEntries, notesPath);
    } else {
      set({ starredEntries: updatedEntries });
    }
    saveStarredRegistry(updatedEntries);
    return;
  }

  if (!notesPath) {
    return;
  }

  const relativePath = resolveStarredRelativePathForVault(path, notesPath);
  if (!relativePath) {
    return;
  }

  const updatedEntries = [...starredEntries, createStarredEntry(kind, notesPath, relativePath)];

  applyStarredState(set, updatedEntries, notesPath);
  saveStarredRegistry(updatedEntries);
}

export function removeStarredEntryById(
  set: (partial: Partial<NotesStore>) => void,
  get: () => NotesStore,
  id: string
): void {
  const { notesPath, starredEntries } = get();
  const updatedEntries = starredEntries.filter((entry) => entry.id !== id);
  if (updatedEntries.length === starredEntries.length) {
    return;
  }

  if (notesPath) {
    applyStarredState(set, updatedEntries, notesPath);
  } else {
    set({ starredEntries: updatedEntries });
  }
  saveStarredRegistry(updatedEntries);
}
