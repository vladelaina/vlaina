import { useCallback, useEffect, useState } from 'react';
import { messageDialog } from '@/lib/storage/dialog';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { normalizeVaultPath } from '@/stores/vaultConfig';
import { resolveOpenNoteTarget } from '../features/OpenTarget/openTargetSelection';
import { subscribeOpenMarkdownTargetEvent } from '../features/OpenTarget/openTargetEvents';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';
import { useNotesOpenTargetPicker } from './useNotesOpenTargetPicker';
import { logNotesDebug } from '@/stores/notes/lineBreakDebugLog';

export function useNotesOpenMarkdownTarget({
  active,
  currentVaultPath,
  notesPath,
  currentNotePath,
  isDirty,
  saveNote,
  openNote,
  openNoteByAbsolutePath,
  adoptAbsoluteNoteIntoVault,
  openVault,
}: {
  active: boolean;
  currentVaultPath: string | null;
  notesPath: string;
  currentNotePath: string | undefined;
  isDirty: boolean;
  saveNote: () => Promise<void>;
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string) => Promise<void>;
  adoptAbsoluteNoteIntoVault: (absolutePath: string, notePath: string) => boolean;
  openVault: (path: string) => Promise<boolean>;
}) {
  const [isOpenTargetBusy, setIsOpenTargetBusy] = useState(false);
  const [pendingShortcutNoteTarget, setPendingShortcutNoteTarget] = useState<{
    vaultPath: string;
    notePath: string;
    absolutePath: string;
    startedAt: number;
  } | null>(null);

  const openShortcutNoteTarget = useCallback(async (target: {
    vaultPath: string;
    notePath: string;
    absolutePath: string;
  }) => {
    const store = useNotesStore.getState();
    const activeNotesPath = store.notesPath;
    const currentPath = store.currentNote?.path;
    logNotesDebug('NotesOpenTarget', 'shortcut:start', {
      target,
      activeNotesPath,
      currentPath: currentPath ?? null,
      currentVaultPath,
      openTabsLength: store.openTabs.length,
      isDirty: store.isDirty,
    });

    if (activeNotesPath === target.vaultPath && currentPath === target.absolutePath) {
      const adopted = adoptAbsoluteNoteIntoVault(target.absolutePath, target.notePath);
      logNotesDebug('NotesOpenTarget', 'shortcut:adopt-absolute', {
        target,
        adopted,
      });
      if (adopted) return true;
    }

    if (activeNotesPath === target.vaultPath) {
      logNotesDebug('NotesOpenTarget', 'shortcut:open-relative', {
        notePath: target.notePath,
        vaultPath: target.vaultPath,
      });
      await openNote(target.notePath);
      const openedPath = useNotesStore.getState().currentNote?.path;
      logNotesDebug('NotesOpenTarget', 'shortcut:open-relative:result', {
        expectedPath: target.notePath,
        openedPath: openedPath ?? null,
      });
      if (openedPath === target.notePath) return true;
    }

    logNotesDebug('NotesOpenTarget', 'shortcut:open-absolute', {
      absolutePath: target.absolutePath,
    });
    await openNoteByAbsolutePath(target.absolutePath);
    const openedPath = useNotesStore.getState().currentNote?.path;
    logNotesDebug('NotesOpenTarget', 'shortcut:open-absolute:result', {
      expectedAbsolutePath: target.absolutePath,
      expectedRelativePath: target.notePath,
      openedPath: openedPath ?? null,
    });
    return openedPath === target.absolutePath || openedPath === target.notePath;
  }, [adoptAbsoluteNoteIntoVault, currentVaultPath, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!pendingShortcutNoteTarget || !currentVaultPath) return;
    if (currentVaultPath !== pendingShortcutNoteTarget.vaultPath) return;

    let cancelled = false;

    const openPendingShortcutNote = async () => {
      let opened = false;

      try {
        opened = await openShortcutNoteTarget(pendingShortcutNoteTarget);
      } finally {
        if (!cancelled) {
          setPendingShortcutNoteTarget(null);
        }
      }

      if (!cancelled && !opened) {
        await messageDialog('Failed to open the selected Markdown file.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    };

    void openPendingShortcutNote();

    return () => {
      cancelled = true;
    };
  }, [currentVaultPath, openShortcutNoteTarget, pendingShortcutNoteTarget]);

  const saveCurrentNoteIfNeeded = useCallback(async () => {
    logNotesDebug('NotesOpenTarget', 'save-current:evaluate', {
      currentNotePath: currentNotePath ?? null,
      isDirty,
      isDraftNote: isDraftNotePath(currentNotePath),
    });
    if (!isDirty) return true;
    if (isDraftNotePath(currentNotePath)) return true;
    await saveNote();
    const cleanAfterSave = !useNotesStore.getState().isDirty;
    logNotesDebug('NotesOpenTarget', 'save-current:after-save', {
      currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
      cleanAfterSave,
      isDirtyAfterSave: useNotesStore.getState().isDirty,
    });
    return cleanAfterSave;
  }, [currentNotePath, isDirty, saveNote]);

  const openMarkdownTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    logNotesDebug('NotesOpenTarget', 'markdown:start', {
      selected,
      currentVaultPath,
      notesPath,
      currentNotePath: currentNotePath ?? null,
      isDirty,
      openTabsLength: useNotesStore.getState().openTabs.length,
    });
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        logNotesDebug('NotesOpenTarget', 'markdown:blocked-unsaved-current', {
          selected,
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
          isDirtyAfterSaveAttempt: useNotesStore.getState().isDirty,
        });
        return;
      }

      const target = resolveOpenNoteTarget(selected);
      const normalizedTargetVaultPath = normalizeVaultPath(target.vaultPath);
      logNotesDebug('NotesOpenTarget', 'markdown:resolved', {
        selected,
        target,
        normalizedTargetVaultPath,
      });

      if (currentVaultPath === normalizedTargetVaultPath && notesPath === normalizedTargetVaultPath) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedTargetVaultPath,
          notePath: target.notePath,
          absolutePath: selected,
        });
        logNotesDebug('NotesOpenTarget', 'markdown:same-vault-result', {
          selected,
          opened,
          currentNotePathAfterOpen: useNotesStore.getState().currentNote?.path ?? null,
        });
        if (!opened) {
          await messageDialog('Failed to open the selected Markdown file.', {
            title: 'Open Failed',
            kind: 'error',
          });
        }
        return;
      }

      setPendingShortcutNoteTarget({
        vaultPath: normalizedTargetVaultPath,
        notePath: target.notePath,
        absolutePath: selected,
        startedAt: performance.now(),
      });
      logNotesDebug('NotesOpenTarget', 'markdown:pending-shortcut-set', {
        normalizedTargetVaultPath,
        notePath: target.notePath,
        absolutePath: selected,
        currentVaultPath,
      });

      if (currentVaultPath === normalizedTargetVaultPath) {
        return;
      }

      const openedVault = await openVault(normalizedTargetVaultPath);
      logNotesDebug('NotesOpenTarget', 'markdown:open-vault-result', {
        normalizedTargetVaultPath,
        openedVault,
      });
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog('Failed to open the selected vault.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      setPendingShortcutNoteTarget(null);
      logNotesDebug('NotesOpenTarget', 'markdown:failed', {
        selected,
        message: error instanceof Error ? error.message : String(error),
      });
      await messageDialog(error instanceof Error ? error.message : 'Failed to open the selected Markdown file.', {
        title: 'Open Failed',
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
      logNotesDebug('NotesOpenTarget', 'markdown:finish', {
        selected,
        currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
        isDirty: useNotesStore.getState().isDirty,
        openTabsLength: useNotesStore.getState().openTabs.length,
      });
    }
  }, [currentNotePath, currentVaultPath, isDirty, notesPath, openShortcutNoteTarget, openVault, saveCurrentNoteIfNeeded]);

  const openFolderTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    logNotesDebug('NotesOpenTarget', 'folder:start', {
      selected,
      currentVaultPath,
      notesPath,
      currentNotePath: currentNotePath ?? null,
      isDirty,
    });
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        logNotesDebug('NotesOpenTarget', 'folder:blocked-unsaved-current', {
          selected,
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
          isDirtyAfterSaveAttempt: useNotesStore.getState().isDirty,
        });
        return;
      }

      const openedVault = await openVault(selected);
      logNotesDebug('NotesOpenTarget', 'folder:open-vault-result', {
        selected,
        openedVault,
        currentVaultPathAfterOpen: currentVaultPath,
        notesPathAfterOpen: useNotesStore.getState().notesPath,
      });
      if (!openedVault) {
        await messageDialog('Failed to open the selected folder.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      logNotesDebug('NotesOpenTarget', 'folder:failed', {
        selected,
        message: error instanceof Error ? error.message : String(error),
      });
      await messageDialog(error instanceof Error ? error.message : 'Failed to open the selected folder.', {
        title: 'Open Failed',
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
      logNotesDebug('NotesOpenTarget', 'folder:finish', {
        selected,
        currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
        isDirty: useNotesStore.getState().isDirty,
        openTabsLength: useNotesStore.getState().openTabs.length,
      });
    }
  }, [currentNotePath, currentVaultPath, isDirty, notesPath, openVault, saveCurrentNoteIfNeeded]);

  useNotesOpenTargetPicker({
    active,
    currentVaultPath,
    isOpenTargetBusy,
    openMarkdownTarget,
    openFolderTarget,
  });

  useEffect(() => {
    return subscribeOpenMarkdownTargetEvent((absolutePath) => {
      void openMarkdownTarget(absolutePath);
    });
  }, [openMarkdownTarget]);

  return {
    isOpenTargetBusy,
    openMarkdownTarget,
    pendingOpenMarkdownTargetVaultPath: pendingShortcutNoteTarget?.vaultPath ?? null,
    openStoredNotePath,
  };
}
