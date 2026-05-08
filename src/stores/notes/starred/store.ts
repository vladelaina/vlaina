import type { NotesStore, StarredKind } from '../types';
import { createStarredEntry, getVaultStarredPaths } from './registry';
import { loadStarredRegistry, saveStarredRegistry } from './persistence';
import { createStarredEntryFromAbsoluteNotePath, findStarredEntryByPath, isStarredEntryForPath } from './entryPaths';
import {
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

  const relativePath = notesPath ? resolveStarredRelativePathForVault(path, notesPath) : null;
  const nextEntry = relativePath
    ? createStarredEntry(kind, notesPath, relativePath)
    : kind === 'note'
      ? createStarredEntryFromAbsoluteNotePath(path)
      : null;

  if (!nextEntry) {
    return;
  }

  const updatedEntries = [...starredEntries, nextEntry];

  if (notesPath) {
    applyStarredState(set, updatedEntries, notesPath);
  } else {
    set({ starredEntries: updatedEntries });
  }
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
