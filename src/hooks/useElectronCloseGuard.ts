import { useCallback, useEffect, useRef, useState } from 'react';
import { flushWhiteboardStorage } from '@/components/Whiteboard/storage';
import { desktopWindow } from '@/lib/desktop/window';
import { isElectronRuntime } from '@/lib/electron/bridge';
import { flushPendingSessionJsonSaves } from '@/lib/storage/chatStorage';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { getAutoSaveableDraftPaths, saveAutoSaveableDrafts } from '@/stores/notes/autoSaveableDrafts';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { flushStarredRegistry } from '@/stores/notes/starred';
import { saveWorkspaceSnapshot } from '@/stores/notes/workspacePersistence';
import { useNotesStore } from '@/stores/useNotesStore';
import { useCloseDraftPersistence } from './useCloseDraftPersistence';

const CLOSE_FLUSH_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 20 : 5000;

async function withCloseTimeout<T>(task: Promise<T>, fallbackValue: T, _failureLabel: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallbackValue);
    }, CLOSE_FLUSH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([task, timeout]);
  } catch (error) {
    return fallbackValue;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

async function withCloseFlushTimeout(flush: Promise<boolean>): Promise<boolean> {
  return withCloseTimeout(flush, false, 'Flushing pending writes');
}

export function useElectronCloseGuard() {
  const [isCloseDraftConfirmOpen, setIsCloseDraftConfirmOpen] = useState(false);
  const [isCloseFailureConfirmOpen, setIsCloseFailureConfirmOpen] = useState(false);
  const allowNextWindowCloseRef = useRef(false);
  const runFlushAllPendingWritesRef = useRef<() => Promise<boolean>>(async () => true);
  const {
    hasAutoSaveableDrafts,
    hasDiscardableDrafts,
    restorePathAfterCloseInterruption,
    saveAutoSaveableDraftsBeforeClose,
    saveDraftsBeforeClose,
  } = useCloseDraftPersistence();

  const forceWindowClose = useCallback(async () => {
    setIsCloseFailureConfirmOpen(false);
    try {
      allowNextWindowCloseRef.current = true;
      await desktopWindow.confirmClose();
    } catch {
      allowNextWindowCloseRef.current = false;
    }
  }, []);

  const interruptCloseForSaveFailure = useCallback((restorePath: string | null) => {
    setIsCloseFailureConfirmOpen(true);
    void restorePathAfterCloseInterruption(restorePath).catch((_error) => {
    });
  }, [restorePathAfterCloseInterruption]);

  const continueWindowClose = useCallback(async (options?: { skipDraftConfirm?: boolean; saveDrafts?: boolean }) => {
    const skipDraftConfirm = options?.skipDraftConfirm ?? false;
    const saveDrafts = options?.saveDrafts ?? false;
    const autoSaveResult = await withCloseTimeout(
      saveAutoSaveableDraftsBeforeClose(),
      { saved: false, restorePath: useNotesStore.getState().currentNote?.path ?? null },
      'Saving auto-saveable drafts'
    );
    let restorePath: string | null = autoSaveResult.restorePath;

    if (!autoSaveResult.saved) {
      interruptCloseForSaveFailure(restorePath);
      return;
    }

    const hasUnsavedDrafts = hasDiscardableDrafts();

    if (hasUnsavedDrafts && !skipDraftConfirm) {
      setIsCloseDraftConfirmOpen(true);
      return;
    }

    if (saveDrafts) {
      const saveResult = await withCloseTimeout(
        saveDraftsBeforeClose(),
        { saved: false, restorePath },
        'Saving drafts'
      );
      restorePath = saveResult.restorePath;
      if (!saveResult.saved) {
        interruptCloseForSaveFailure(restorePath);
        return;
      }
    }

    const flushed = await runFlushAllPendingWritesRef.current();
    if (!flushed) {
      interruptCloseForSaveFailure(restorePath);
      return;
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
    interruptCloseForSaveFailure,
    restorePathAfterCloseInterruption,
    saveAutoSaveableDraftsBeforeClose,
    saveDraftsBeforeClose,
  ]);

  useEffect(() => {
    if (!isElectronRuntime()) return;

    let activeFlush: Promise<boolean> | null = null;
    let unlistenCloseRequested: (() => void) | null = null;

    const runFlushAllPendingWrites = async (): Promise<boolean> => {
      if (activeFlush) return withCloseFlushTimeout(activeFlush);

      activeFlush = (async () => {
        flushCurrentPendingEditorMarkdown();

        const tasks: Array<{ name: string; task: Promise<unknown> }> = [
          { name: 'unified storage', task: flushPendingSave() },
          { name: 'chat session storage', task: flushPendingSessionJsonSaves() },
          { name: 'starred notes registry', task: flushStarredRegistry() },
          { name: 'whiteboard storage', task: flushWhiteboardStorage() },
        ];

        const initialNotesState = useNotesStore.getState();
        const hasInitialDirtyRegularTabs = initialNotesState.openTabs.some(
          (tab) => tab.isDirty && !isDraftNotePath(tab.path)
        );
        const currentInitialRegularDirty =
          initialNotesState.isDirty && !isDraftNotePath(initialNotesState.currentNote?.path);
        const hasNotesWork =
          getAutoSaveableDraftPaths().length > 0 ||
          hasInitialDirtyRegularTabs ||
          currentInitialRegularDirty;

        if (hasNotesWork) {
          tasks.push({
            name: 'notes storage',
            task: (async () => {
              if (getAutoSaveableDraftPaths().length > 0) {
                const savedDrafts = await saveAutoSaveableDrafts();
                if (!savedDrafts) {
                  throw new Error('Auto-saveable drafts still pending after save attempt');
                }
              }

              const nextNotesState = useNotesStore.getState();
              const hasDirtyRegularTabs = nextNotesState.openTabs.some(
                (tab) => tab.isDirty && !isDraftNotePath(tab.path)
              );
              const currentRegularDirty =
                nextNotesState.isDirty && !isDraftNotePath(nextNotesState.currentNote?.path);

              if (hasDirtyRegularTabs || currentRegularDirty) {
                const savedRegularTabs = await saveDirtyRegularOpenTabs();
                const finalNotesState = useNotesStore.getState();
                const stillHasDirtyRegularTabs = finalNotesState.openTabs.some(
                  (tab) => tab.isDirty && !isDraftNotePath(tab.path)
                );
                const finalCurrentRegularDirty =
                  finalNotesState.isDirty && !isDraftNotePath(finalNotesState.currentNote?.path);
                if (!savedRegularTabs || finalCurrentRegularDirty || stillHasDirtyRegularTabs) {
                  throw new Error('Notes still dirty after save attempt');
                }
              }
            })(),
          });
        }

        const results = await Promise.allSettled(tasks.map((entry) => entry.task));
        let hasFailure = false;

        results.forEach((result, _index) => {
          if (result.status === 'rejected') {
            hasFailure = true;
          }
        });

        const nextNotesState = useNotesStore.getState();
        const stillHasDirtyRegularTabs = nextNotesState.openTabs.some(
          (tab) => tab.isDirty && !isDraftNotePath(tab.path)
        );
        const currentRegularDirty =
          nextNotesState.isDirty && !isDraftNotePath(nextNotesState.currentNote?.path);
        if (!hasFailure && !currentRegularDirty && !stillHasDirtyRegularTabs && nextNotesState.notesPath) {
          await saveWorkspaceSnapshot(nextNotesState.notesPath, {
            rootFolder: nextNotesState.rootFolder,
            currentNotePath: nextNotesState.currentNote?.path ?? null,
            fileTreeSortMode: nextNotesState.fileTreeSortMode,
          }).catch(() => {
            hasFailure = true;
          });
        }

        return !hasFailure && !currentRegularDirty && !stillHasDirtyRegularTabs;
      })().finally(() => {
        activeFlush = null;
      });

      return withCloseFlushTimeout(activeFlush);
    };

    const flushAllPendingWrites = () => {
      void Promise.resolve(runFlushAllPendingWrites()).catch(() => undefined);
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

      flushCurrentPendingEditorMarkdown();

      const notesState = useNotesStore.getState();
      const hasAutoSaveableUnsavedDrafts = hasAutoSaveableDrafts();
      const hasUnsavedDrafts = hasDiscardableDrafts();

      const hasDirtyRegularTabs = notesState.openTabs.some(
        (tab) => tab.isDirty && !isDraftNotePath(tab.path)
      );

      if (!notesState.isDirty && !hasDirtyRegularTabs && !hasUnsavedDrafts && !hasAutoSaveableUnsavedDrafts) {
        void (async () => {
          const flushed = await runFlushAllPendingWritesRef.current();
          if (!flushed) {
            setIsCloseFailureConfirmOpen(true);
            return;
          }
          try {
            allowNextWindowCloseRef.current = true;
            await desktopWindow.confirmClose();
          } catch {
            allowNextWindowCloseRef.current = false;
          }
        })().catch(() => undefined);
        return;
      }

      void continueWindowClose().catch(() => undefined);
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
    isCloseFailureConfirmOpen,
    setIsCloseDraftConfirmOpen,
    setIsCloseFailureConfirmOpen,
    continueWindowClose,
    forceWindowClose,
  };
}
