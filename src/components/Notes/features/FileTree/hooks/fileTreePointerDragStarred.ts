import { useNotesStore } from '@/stores/useNotesStore';
import {
  createStarredEntryIfValid,
  getStarredEntryKey,
  getNotesRootStarredPaths,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import type { StarredKind } from '@/stores/notes/types';

export function ensureStarredPath(kind: StarredKind, relativePath: string) {
  const state = useNotesStore.getState();
  const { notesPath, starredEntries } = state;
  if (!notesPath) return;

  const nextEntry = createStarredEntryIfValid(kind, notesPath, relativePath);
  if (!nextEntry) {
    return;
  }

  const key = getStarredEntryKey(nextEntry);
  if (starredEntries.some((entry) => getStarredEntryKey(entry) === key)) {
    return;
  }

  const updatedEntries = [...starredEntries, nextEntry];
  const starredPaths = getNotesRootStarredPaths(updatedEntries, notesPath);
  useNotesStore.setState({
    starredEntries: updatedEntries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
  });
  saveStarredRegistry(updatedEntries);
}
