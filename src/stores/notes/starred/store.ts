import type { NotesStore, StarredKind } from '../types';
import { createStarredEntry, getStarredEntryKey, getVaultStarredPaths } from './registry';
import { loadStarredRegistry, saveStarredRegistry } from './persistence';
import { logNotesDebug } from '../lineBreakDebugLog';

let starredLoadRequestId = 0;

function applyStarredState(
  set: (partial: Partial<NotesStore>) => void,
  entries: NotesStore['starredEntries'],
  vaultPath: string
) {
  const starredPaths = getVaultStarredPaths(entries, vaultPath);
  logNotesDebug('NotesStarred', 'apply-state', {
    vaultPath,
    entriesLength: entries.length,
    starredNotesLength: starredPaths.notes.length,
    starredFoldersLength: starredPaths.folders.length,
  });
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
  logNotesDebug('NotesStarred', 'load:start', {
    requestId,
    vaultPath,
    existingEntriesLength: get().starredEntries.length,
  });
  applyStarredState(set, get().starredEntries, vaultPath);
  set({ starredLoaded: false });
  const data = await loadStarredRegistry();
  if (requestId !== starredLoadRequestId) {
    logNotesDebug('NotesStarred', 'load:stale', {
      requestId,
      latestRequestId: starredLoadRequestId,
      vaultPath,
    });
    return;
  }

  applyStarredState(set, data.entries, vaultPath);
  set({ starredLoaded: true });
  logNotesDebug('NotesStarred', 'load:completed', {
    requestId,
    vaultPath,
    entriesLength: data.entries.length,
  });
}

export function toggleStarredEntry(
  set: (partial: Partial<NotesStore>) => void,
  get: () => NotesStore,
  kind: StarredKind,
  relativePath: string
): void {
  const { notesPath, starredEntries } = get();
  if (!notesPath) {
    logNotesDebug('NotesStarred', 'toggle:skipped-no-vault', { kind, relativePath });
    return;
  }

  const key = getStarredEntryKey({ kind, vaultPath: notesPath, relativePath });
  const hasEntry = starredEntries.some((entry) => getStarredEntryKey(entry) === key);
  const updatedEntries = hasEntry
    ? starredEntries.filter((entry) => getStarredEntryKey(entry) !== key)
    : [...starredEntries, createStarredEntry(kind, notesPath, relativePath)];

  logNotesDebug('NotesStarred', 'toggle', {
    kind,
    relativePath,
    notesPath,
    action: hasEntry ? 'remove' : 'add',
    previousEntriesLength: starredEntries.length,
    nextEntriesLength: updatedEntries.length,
  });
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
    logNotesDebug('NotesStarred', 'remove:skipped-missing-id', {
      id,
      entriesLength: starredEntries.length,
    });
    return;
  }

  logNotesDebug('NotesStarred', 'remove', {
    id,
    notesPath,
    previousEntriesLength: starredEntries.length,
    nextEntriesLength: updatedEntries.length,
  });
  if (notesPath) {
    applyStarredState(set, updatedEntries, notesPath);
  } else {
    set({ starredEntries: updatedEntries });
  }
  saveStarredRegistry(updatedEntries);
}
