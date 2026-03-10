import type { NotesStore, StarredKind } from '../types';
import { createStarredEntry, getStarredEntryKey, getVaultStarredPaths } from './registry';
import { loadStarredRegistry, saveStarredRegistry } from './persistence';

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
  relativePath: string
): void {
  const { notesPath, starredEntries } = get();
  if (!notesPath) return;

  const key = getStarredEntryKey({ kind, vaultPath: notesPath, relativePath });
  const hasEntry = starredEntries.some((entry) => getStarredEntryKey(entry) === key);
  const updatedEntries = hasEntry
    ? starredEntries.filter((entry) => getStarredEntryKey(entry) !== key)
    : [...starredEntries, createStarredEntry(kind, notesPath, relativePath)];

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
  if (updatedEntries.length === starredEntries.length) return;

  if (notesPath) {
    applyStarredState(set, updatedEntries, notesPath);
  } else {
    set({ starredEntries: updatedEntries });
  }
  saveStarredRegistry(updatedEntries);
}
