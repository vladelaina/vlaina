import { findNode } from '@/stores/notes/fileTreeUtils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { isMarkdownPath } from './notesExternalSyncUtils';
import { createCurrentNoteExternalSync } from './notesExternalCurrentNoteSync';
import { createNotesExternalSyncTimers } from './notesExternalSyncTimers';
import {
  MAX_PENDING_EXTERNAL_PATH_EVENTS,
  type CreateNotesExternalSyncActionsOptions,
} from './notesExternalSyncActionTypes';

export function createNotesExternalSyncContext(options: CreateNotesExternalSyncActionsOptions) {
  const {
    notesPath,
    loadFileTree,
    invalidateNoteCache,
    syncCurrentNoteFromDisk,
    applyExternalPathRename,
    applyExternalPathDeletion,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
    pendingCreatesRef,
    reconcileInFlightRef,
  } = options;
  let pendingPathQueueOverflowed = false;

  const { applyExternalDeletion, reconcileCurrentNote } = createCurrentNoteExternalSync({
    syncCurrentNoteFromDisk,
    applyExternalPathDeletion,
  });
  const { clearTimers: clearExternalSyncTimers, scheduleFileTreeReload } = createNotesExternalSyncTimers({
    loadFileTree,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
  });
  const isActiveNotesPath = () => useNotesStore.getState().notesPath === notesPath;
  const capPendingPathQueue = <Entry>(queue: Entry[]): Entry[] => {
    if (queue.length <= MAX_PENDING_EXTERNAL_PATH_EVENTS) {
      return queue;
    }

    pendingPathQueueOverflowed = true;
    return queue.slice(queue.length - MAX_PENDING_EXTERNAL_PATH_EVENTS);
  };
  const isKnownFolderPath = (path: string) => {
    const state = useNotesStore.getState();
    const rootFolder = state.rootFolder;
    const node = rootFolder ? findNode(rootFolder.children, path) : null;
    if (node?.isFolder) {
      return true;
    }

    const childPrefix = `${path}/`;
    return Boolean(
      state.currentNote?.path.startsWith(childPrefix) ||
      state.openTabs.some((tab) => tab.path.startsWith(childPrefix)) ||
      state.recentNotes.some((recentPath) => recentPath.startsWith(childPrefix)) ||
      [...state.noteContentsCache.keys()].some((cachedPath) => cachedPath.startsWith(childPrefix)) ||
      Object.keys(state.noteMetadata?.notes ?? {}).some((metadataPath) => metadataPath.startsWith(childPrefix))
    );
  };
  const isFolderRename = (
    oldPath: string,
    oldKind: string | null | undefined,
    newKind: string | null | undefined
  ) => {
    if (oldKind === 'folder') {
      return true;
    }

    if (oldKind === 'file' || newKind === 'file') {
      return false;
    }

    if (newKind === 'folder') {
      return isKnownFolderPath(oldPath);
    }

    return isKnownFolderPath(oldPath);
  };
  const isUnknownPathKind = (kind: string | null | undefined) => !kind || kind === 'any';
  const canPairPendingRenameKinds = (
    oldKind: string | null | undefined,
    newKind: string | null | undefined
  ) => {
    if (isUnknownPathKind(oldKind) || isUnknownPathKind(newKind)) {
      return true;
    }

    return oldKind === newKind;
  };
  const isRelevantDeletedPath = (path: string, kind: string | null | undefined) => {
    if (kind === 'folder') {
      return true;
    }

    if (kind !== 'file' && isKnownFolderPath(path)) {
      return true;
    }

    return isMarkdownPath(path);
  };
  const isPathWithin = (path: string, basePath: string) => (
    basePath === '' || path === basePath || path.startsWith(`${basePath}/`)
  );

  const applyExternalRenamePathChange = async (
    oldPath: string,
    newPath: string,
    oldKind?: string | null,
    newKind?: string | null
  ) => {
    const hasExplicitFolderEndpoint = oldKind === 'folder' || newKind === 'folder';
    if (
      isFolderRename(oldPath, oldKind, newKind) ||
      (!hasExplicitFolderEndpoint && isMarkdownPath(oldPath) && isMarkdownPath(newPath))
    ) {
      await applyExternalPathRename(oldPath, newPath);
      return true;
    }

    if (isMarkdownPath(oldPath)) {
      await applyExternalDeletion(oldPath);
      return true;
    }

    if (isMarkdownPath(newPath)) {
      invalidateNoteCache(newPath);
      return true;
    }

    return false;
  };

  return {
    applyExternalDeletion,
    applyExternalRenamePathChange,
    canPairPendingRenameKinds,
    capPendingPathQueue,
    clearExternalSyncTimers,
    consumePendingPathQueueOverflowed() {
      const hadPendingQueueOverflow = pendingPathQueueOverflowed;
      pendingPathQueueOverflowed = false;
      return hadPendingQueueOverflow;
    },
    invalidateNoteCache,
    isActiveNotesPath,
    isKnownFolderPath,
    isPathWithin,
    isRelevantDeletedPath,
    loadFileTree,
    notesPath,
    pendingCreatesRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
    reconcileCurrentNote,
    reconcileInFlightRef,
    scheduleFileTreeReload,
    setPendingPathQueueOverflowed() {
      pendingPathQueueOverflowed = true;
    },
    syncCurrentNoteFromDisk,
  };
}

export type NotesExternalSyncContext = ReturnType<typeof createNotesExternalSyncContext>;
