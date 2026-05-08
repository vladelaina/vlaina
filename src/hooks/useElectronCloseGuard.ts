import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopWindow } from '@/lib/desktop/window';
import { isElectronRuntime } from '@/lib/electron/bridge';
import { flushPendingSessionJsonSaves } from '@/lib/storage/chatStorage';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { getAutoSaveableDraftPaths, saveAutoSaveableDrafts } from '@/stores/notes/autoSaveableDrafts';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { useNotesStore } from '@/stores/useNotesStore';
import { useCloseDraftPersistence } from './useCloseDraftPersistence';

export function useElectronCloseGuard() {
  const [isCloseDraftConfirmOpen, setIsCloseDraftConfirmOpen] = useState(false);
  const allowNextWindowCloseRef = useRef(false);
  const runFlushAllPendingWritesRef = useRef<() => Promise<boolean>>(async () => true);
  const {
    hasAutoSaveableDrafts,
    hasDiscardableDrafts,
    restorePathAfterCloseInterruption,
    saveAutoSaveableDraftsBeforeClose,
    saveDraftsBeforeClose,
  } = useCloseDraftPersistence();

  const continueWindowClose = useCallback(async (options?: { skipDraftConfirm?: boolean; saveDrafts?: boolean }) => {
    const skipDraftConfirm = options?.skipDraftConfirm ?? false;
    const saveDrafts = options?.saveDrafts ?? false;
    const autoSaveResult = await saveAutoSaveableDraftsBeforeClose();
    let restorePath: string | null = autoSaveResult.restorePath;

    if (!autoSaveResult.saved) {
      return;
    }

    const hasUnsavedDrafts = hasDiscardableDrafts();

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
    const hasDirtyRegularTabs = latestNotesState.openTabs.some(
      (tab) => tab.isDirty && !isDraftNotePath(tab.path)
    );
    if (
      hasDirtyRegularTabs ||
      (latestNotesState.isDirty && !isDraftNotePath(latestNotesState.currentNote?.path))
    ) {
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
  }, [
    hasDiscardableDrafts,
    restorePathAfterCloseInterruption,
    saveAutoSaveableDraftsBeforeClose,
    saveDraftsBeforeClose,
  ]);

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
        if (getAutoSaveableDraftPaths().length > 0) {
          tasks.push({
            name: 'draft notes storage',
            task: saveAutoSaveableDrafts().then((saved) => {
              if (!saved) {
                throw new Error('Auto-saveable drafts still pending after save attempt');
              }
            }),
          });
        }

        const hasDirtyRegularTabs = notesState.openTabs.some(
          (tab) => tab.isDirty && !isDraftNotePath(tab.path)
        );
        if (
          hasDirtyRegularTabs ||
          (notesState.isDirty && !isDraftNotePath(notesState.currentNote?.path))
        ) {
          tasks.push({
            name: 'notes storage',
            task: saveDirtyRegularOpenTabs().then((saved) => {
              const nextNotesState = useNotesStore.getState();
              const stillHasDirtyRegularTabs = nextNotesState.openTabs.some(
                (tab) => tab.isDirty && !isDraftNotePath(tab.path)
              );
              if (!saved || nextNotesState.isDirty || stillHasDirtyRegularTabs) {
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

        const nextNotesState = useNotesStore.getState();
        const stillHasDirtyRegularTabs = nextNotesState.openTabs.some(
          (tab) => tab.isDirty && !isDraftNotePath(tab.path)
        );
        return !hasFailure && !nextNotesState.isDirty && !stillHasDirtyRegularTabs;
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
      const hasAutoSaveableUnsavedDrafts = hasAutoSaveableDrafts();
      const hasUnsavedDrafts = hasDiscardableDrafts();

      const hasDirtyRegularTabs = notesState.openTabs.some(
        (tab) => tab.isDirty && !isDraftNotePath(tab.path)
      );

      if (!notesState.isDirty && !hasDirtyRegularTabs && !hasUnsavedDrafts && !hasAutoSaveableUnsavedDrafts) {
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
  }, [continueWindowClose, hasAutoSaveableDrafts, hasDiscardableDrafts]);

  return {
    isCloseDraftConfirmOpen,
    setIsCloseDraftConfirmOpen,
    continueWindowClose,
  };
}
