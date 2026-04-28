import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopWindow } from '@/lib/desktop/window';
import { isElectronRuntime } from '@/lib/electron/bridge';
import { flushPendingSessionJsonSaves } from '@/lib/storage/chatStorage';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/useNotesStore';

export function useElectronCloseGuard() {
  const [isCloseDraftConfirmOpen, setIsCloseDraftConfirmOpen] = useState(false);
  const allowNextWindowCloseRef = useRef(false);
  const runFlushAllPendingWritesRef = useRef<() => Promise<boolean>>(async () => true);

  const getDiscardableDraftPaths = useCallback(() => {
    const notesState = useNotesStore.getState();

    return notesState.openTabs.flatMap((tab) => {
      if (!isDraftNotePath(tab.path)) return [];

      const draftEntry = notesState.draftNotes[tab.path];
      const hasDraftTitle = Boolean(draftEntry?.name.trim());
      const draftContent = notesState.noteContentsCache.get(tab.path)?.content ?? '';
      const draftMetadata = notesState.noteMetadata?.notes[tab.path];

      return hasDraftUnsavedChanges({
        draftName: hasDraftTitle ? draftEntry?.name : draftEntry?.name,
        content: draftContent,
        metadata: draftMetadata,
      }) ? [tab.path] : [];
    });
  }, []);

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

  const continueWindowClose = useCallback(async (options?: { skipDraftConfirm?: boolean; saveDrafts?: boolean }) => {
    const skipDraftConfirm = options?.skipDraftConfirm ?? false;
    const saveDrafts = options?.saveDrafts ?? false;
    const hasUnsavedDrafts = hasDiscardableDrafts();
    let restorePath: string | null = null;

    if (hasUnsavedDrafts && !skipDraftConfirm) {
      setIsCloseDraftConfirmOpen(true);
      return;
    }

    if (saveDrafts) {
      const saveResult = await saveDraftsBeforeClose();
      restorePath = saveResult.restorePath;
      if (!saveResult.saved) return;
    }

    const latestNotesState = useNotesStore.getState();
    if (latestNotesState.isDirty && !isDraftNotePath(latestNotesState.currentNote?.path)) {
      const flushed = await runFlushAllPendingWritesRef.current();
      if (!flushed) {
        await restorePathAfterCloseInterruption(restorePath);
        return;
      }
    }

    try {
      allowNextWindowCloseRef.current = true;
      await desktopWindow.confirmClose();
    } catch {
      allowNextWindowCloseRef.current = false;
      await restorePathAfterCloseInterruption(restorePath);
    }
  }, [hasDiscardableDrafts, restorePathAfterCloseInterruption, saveDraftsBeforeClose]);

  useEffect(() => {
    if (!isElectronRuntime()) return;

    let activeFlush: Promise<boolean> | null = null;
    let unlistenCloseRequested: (() => void) | null = null;

    const runFlushAllPendingWrites = async (): Promise<boolean> => {
      if (activeFlush) return activeFlush;

      activeFlush = (async () => {
        const tasks: Array<{ name: string; task: Promise<unknown> }> = [
          { name: 'unified storage', task: flushPendingSave() },
          { name: 'chat session storage', task: flushPendingSessionJsonSaves() },
        ];

        const notesState = useNotesStore.getState();
        if (notesState.isDirty && !isDraftNotePath(notesState.currentNote?.path)) {
          tasks.push({
            name: 'notes storage',
            task: notesState.saveNote().then(() => {
              if (useNotesStore.getState().isDirty) {
                throw new Error('Notes still dirty after save attempt');
              }
            }),
          });
        }

        const results = await Promise.allSettled(tasks.map((entry) => entry.task));
        let hasFailure = false;

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            hasFailure = true;
            console.error(`[App] Failed to flush ${tasks[index].name}:`, result.reason);
          }
        });

        return !hasFailure && !useNotesStore.getState().isDirty;
      })().finally(() => {
        activeFlush = null;
      });

      return activeFlush;
    };

    const flushAllPendingWrites = () => {
      void runFlushAllPendingWrites();
    };

    runFlushAllPendingWritesRef.current = runFlushAllPendingWrites;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPendingWrites();
      }
    };

    unlistenCloseRequested = desktopWindow.onCloseRequested(() => {
      if (allowNextWindowCloseRef.current) {
        allowNextWindowCloseRef.current = false;
        return;
      }

      const notesState = useNotesStore.getState();
      const hasUnsavedDrafts = hasDiscardableDrafts();

      if (!notesState.isDirty && !hasUnsavedDrafts) {
        allowNextWindowCloseRef.current = true;
        void desktopWindow.confirmClose();
        return;
      }

      void continueWindowClose();
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushAllPendingWrites);
    window.addEventListener('beforeunload', flushAllPendingWrites);

    return () => {
      unlistenCloseRequested?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushAllPendingWrites);
      window.removeEventListener('beforeunload', flushAllPendingWrites);
      runFlushAllPendingWritesRef.current = async () => true;
    };
  }, [continueWindowClose, hasDiscardableDrafts]);

  return {
    isCloseDraftConfirmOpen,
    setIsCloseDraftConfirmOpen,
    continueWindowClose,
  };
}
