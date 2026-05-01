import type { MutableRefObject } from 'react';
import type { PendingRenameEntry } from './notesExternalRenameQueue';

const FILE_TREE_RELOAD_DEBOUNCE_MS = 220;

interface CreateNotesExternalSyncTimersOptions {
  loadFileTree: (skipRestore?: boolean) => Promise<void>;
  reloadTimerRef: MutableRefObject<number | null>;
  pendingRenameTimerRef: MutableRefObject<number | null>;
  pendingRenamesRef: MutableRefObject<PendingRenameEntry[]>;
}

export function createNotesExternalSyncTimers(options: CreateNotesExternalSyncTimersOptions) {
  const {
    loadFileTree,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
  } = options;

  const scheduleFileTreeReload = () => {
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void loadFileTree(true);
    }, FILE_TREE_RELOAD_DEBOUNCE_MS);
  };

  const clearTimers = () => {
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    if (pendingRenameTimerRef.current !== null) {
      window.clearTimeout(pendingRenameTimerRef.current);
      pendingRenameTimerRef.current = null;
    }
    pendingRenamesRef.current = [];
  };

  return {
    clearTimers,
    scheduleFileTreeReload,
  };
}
