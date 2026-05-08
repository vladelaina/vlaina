import { useCallback } from 'react';
import {
  getAutoSaveableDraftPaths,
  getDiscardableDraftPaths,
  saveAutoSaveableDrafts,
} from '@/stores/notes/autoSaveableDrafts';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/useNotesStore';

export function useCloseDraftPersistence() {
  const restorePathAfterCloseInterruption = useCallback(async (path: string | null) => {
    if (!path) return;

    const notesState = useNotesStore.getState();
    if (!notesState.openTabs.some((tab) => tab.path === path) && notesState.currentNote?.path !== path) {
      return;
    }

    await openStoredNotePath(path, {
      openNote: notesState.openNote,
      openNoteByAbsolutePath: notesState.openNoteByAbsolutePath,
    });
  }, []);

  const hasDiscardableDrafts = useCallback(() => {
    return getDiscardableDraftPaths().length > 0;
  }, [getDiscardableDraftPaths]);

  const hasAutoSaveableDrafts = useCallback(() => {
    return getAutoSaveableDraftPaths().length > 0;
  }, [getAutoSaveableDraftPaths]);

  const saveDraftsBeforeClose = useCallback(async () => {
    const draftPaths = getDiscardableDraftPaths();
    if (draftPaths.length === 0) {
      return {
        saved: true,
        restorePath: useNotesStore.getState().currentNote?.path ?? null,
      };
    }

    let restorePath = useNotesStore.getState().currentNote?.path ?? null;

    for (const draftPath of draftPaths) {
      const latestState = useNotesStore.getState();
      if (latestState.currentNote?.path !== draftPath) {
        await latestState.openNote(draftPath);
      }

      const currentState = useNotesStore.getState();
      if (currentState.currentNote?.path !== draftPath || !currentState.draftNotes[draftPath]) {
        await restorePathAfterCloseInterruption(restorePath);
        return { saved: false, restorePath };
      }

      await currentState.saveNote({ explicit: true, suppressOpenTarget: true });

      const afterSaveState = useNotesStore.getState();
      if (restorePath === draftPath) {
        restorePath = afterSaveState.currentNote?.path ?? restorePath;
      }

      if (afterSaveState.draftNotes[draftPath]) {
        await restorePathAfterCloseInterruption(restorePath);
        return { saved: false, restorePath };
      }
    }

    return { saved: true, restorePath };
  }, [getDiscardableDraftPaths, restorePathAfterCloseInterruption]);

  const saveAutoSaveableDraftsBeforeClose = useCallback(async () => {
    const restorePath = useNotesStore.getState().currentNote?.path ?? null;
    const saved = await saveAutoSaveableDrafts();
    if (!saved) {
      await restorePathAfterCloseInterruption(restorePath);
    }

    return { saved, restorePath };
  }, [restorePathAfterCloseInterruption]);

  return {
    hasAutoSaveableDrafts,
    hasDiscardableDrafts,
    restorePathAfterCloseInterruption,
    saveAutoSaveableDraftsBeforeClose,
    saveDraftsBeforeClose,
  };
}
