import { moveNotesRootSystemStore } from '@/stores/notes/systemStoragePaths';
import { moveWhiteboardNotesRootStore } from '@/lib/storage/whiteboardStoragePaths';
import {
  getNotesRootStarredPaths,
  normalizeStarredNotesRootPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { setCurrentNotesRootPath, useNotesStore } from './useNotesStore';
import { normalizeNotesRootPath } from './notesRootConfig';
import type { NotesRootInfo } from './notesRootStoreTypes';
import { getNotesRootName, loadRecentNotesRootsFromStorage, normalizeNotesRootInfo, normalizeRecentNotesRoots } from './notesRootInfoUtils';
import { persistNotesRootState } from './notesRootPersistence';
import { setWindowNotesRootPath } from './notesRootBroadcast';

export function syncCurrentNotesRootExternalPathAction({
  path,
  currentNotesRoot,
  recentNotesRoots,
  set,
}: {
  path: string;
  currentNotesRoot: NotesRootInfo | null;
  recentNotesRoots: NotesRootInfo[];
  set: (state: { currentNotesRoot?: NotesRootInfo | null; recentNotesRoots?: NotesRootInfo[]; error?: string | null }) => void;
}) {
  if (!currentNotesRoot) return;
  flushCurrentPendingEditorMarkdown();

  const normalizedPath = normalizeNotesRootPath(path);
  const normalizedCurrentNotesRoot = normalizeNotesRootInfo(currentNotesRoot);
  const normalizedCurrentNotesRootPath = normalizeNotesRootPath(normalizedCurrentNotesRoot.path);
  if (!normalizedPath || normalizedPath === normalizedCurrentNotesRootPath) return;
  void Promise.all([
    moveNotesRootSystemStore(normalizedCurrentNotesRootPath, normalizedPath),
    moveWhiteboardNotesRootStore(normalizedCurrentNotesRootPath, normalizedPath),
  ])
    .catch(() => undefined);

  const nextNotesRoot = normalizeNotesRootInfo({
    ...normalizedCurrentNotesRoot,
    name: getNotesRootName(normalizedPath),
    path: normalizedPath,
    lastOpened: Date.now(),
  });
  const nextRecentNotesRoots = normalizeRecentNotesRoots([
    nextNotesRoot,
    ...normalizeRecentNotesRoots(recentNotesRoots).filter(
      (notesRoot) => notesRoot.id !== normalizedCurrentNotesRoot.id && notesRoot.path !== normalizedPath
    ),
  ]);

  persistNotesRootState(nextRecentNotesRoots, nextNotesRoot.id, {
    restoredNotesRoots: [nextNotesRoot],
  });

  const notesState = useNotesStore.getState();
  const normalizedStarredNotesRootPath = normalizeStarredNotesRootPath(normalizedCurrentNotesRootPath);
  const nextStarredEntries = notesState.starredEntries.map((entry) =>
    normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedStarredNotesRootPath
      ? { ...entry, notesRootPath: normalizedPath }
      : entry
  );
  const nextStarredPaths = getNotesRootStarredPaths(nextStarredEntries, normalizedPath);
  const pendingStarredNavigation = notesState.pendingStarredNavigation;
  const nextPendingStarredNavigation =
    pendingStarredNavigation &&
    normalizeStarredNotesRootPath(pendingStarredNavigation.notesRootPath) === normalizedStarredNotesRootPath
      ? { ...pendingStarredNavigation, notesRootPath: normalizedPath }
      : pendingStarredNavigation;

  setWindowNotesRootPath(normalizedPath);
  setCurrentNotesRootPath(normalizedPath);

  notesState.clearAssetUrlCache();
  useNotesStore.setState({
    notesPath: normalizedPath,
    starredEntries: nextStarredEntries,
    starredNotes: nextStarredPaths.notes,
    starredFolders: nextStarredPaths.folders,
    pendingStarredNavigation: nextPendingStarredNavigation,
  });
  void Promise.resolve(saveStarredRegistry(nextStarredEntries)).catch(() => undefined);

  set({
    currentNotesRoot: nextNotesRoot,
    recentNotesRoots: nextRecentNotesRoots,
    error: null,
  });
}

export function removeRecentNotesRootAction({
  id,
  recentNotesRoots,
  currentNotesRoot,
  set,
}: {
  id: string;
  recentNotesRoots: NotesRootInfo[];
  currentNotesRoot: NotesRootInfo | null;
  set: (state: { currentNotesRoot?: NotesRootInfo | null; recentNotesRoots: NotesRootInfo[] }) => void;
}) {
  const deletedNotesRoots = recentNotesRoots.filter((notesRoot) => notesRoot.id === id);
  const updatedRecent = recentNotesRoots.filter((notesRoot) => notesRoot.id !== id);

  persistNotesRootState(updatedRecent, currentNotesRoot?.id === id ? null : currentNotesRoot?.id ?? null, {
    deletedNotesRoots,
  });

  if (currentNotesRoot?.id === id) {
    set({ currentNotesRoot: null, recentNotesRoots: updatedRecent });
  } else {
    set({ recentNotesRoots: updatedRecent });
  }
}

export function closeCurrentNotesRootAction(
  set: (state: { currentNotesRoot: NotesRootInfo | null }) => void,
  recentNotesRoots: NotesRootInfo[] = loadRecentNotesRootsFromStorage(),
) {
  persistNotesRootState(recentNotesRoots, null);
  setWindowNotesRootPath(null);
  setCurrentNotesRootPath(null);
  set({ currentNotesRoot: null });
}
