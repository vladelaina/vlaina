import { useCallback, useEffect, useState } from 'react';
import { onDesktopOpenMarkdownFileShortcut } from '@/lib/desktop/shortcuts';
import { OPEN_MARKDOWN_FILE_ACTION } from '@/lib/notes/openMarkdownFileText';
import { messageDialog, openDialog } from '@/lib/storage/dialog';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { normalizeVaultPath } from '@/stores/vaultConfig';
import {
  getSingleOpenSelection,
  isSupportedMarkdownSelection,
  resolveOpenNoteTarget,
} from '../features/OpenTarget/openTargetSelection';
import { subscribeOpenMarkdownTargetEvent } from '../features/OpenTarget/openTargetEvents';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';

function logOpenMarkdownTarget(event: string, details: Record<string, unknown>) {
  logNotesDebug(`openMarkdownTarget:${event}`, details);
}

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

    if (activeNotesPath === target.vaultPath && currentPath === target.absolutePath) {
      const adopted = adoptAbsoluteNoteIntoVault(target.absolutePath, target.notePath);
      if (adopted) return true;
    }

    if (activeNotesPath === target.vaultPath) {
      await openNote(target.notePath);
      const openedPath = useNotesStore.getState().currentNote?.path;
      if (openedPath === target.notePath) return true;
    }

    await openNoteByAbsolutePath(target.absolutePath);
    const openedPath = useNotesStore.getState().currentNote?.path;
    return openedPath === target.absolutePath || openedPath === target.notePath;
  }, [adoptAbsoluteNoteIntoVault, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!pendingShortcutNoteTarget || !currentVaultPath) return;
    if (currentVaultPath !== pendingShortcutNoteTarget.vaultPath) return;

    let cancelled = false;

    const openPendingShortcutNote = async () => {
      let opened = false;

      try {
        logOpenMarkdownTarget('pending_start', {
          currentVaultPath,
          targetVaultPath: pendingShortcutNoteTarget.vaultPath,
          notePath: pendingShortcutNoteTarget.notePath,
          absolutePath: pendingShortcutNoteTarget.absolutePath,
        });
        opened = await openShortcutNoteTarget(pendingShortcutNoteTarget);
        logOpenMarkdownTarget('pending_result', {
          opened,
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
          openTabPaths: useNotesStore.getState().openTabs.map((tab) => tab.path),
        });
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
    if (!isDirty) return true;
    if (isDraftNotePath(currentNotePath)) return true;
    await saveNote();
    return !useNotesStore.getState().isDirty;
  }, [currentNotePath, isDirty, saveNote]);

  const openMarkdownTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();
      logOpenMarkdownTarget('start', { selected, currentVaultPath, notesPath });

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        logOpenMarkdownTarget('blocked_by_unsaved_note', { selected });
        return;
      }

      const target = resolveOpenNoteTarget(selected);
      const normalizedTargetVaultPath = normalizeVaultPath(target.vaultPath);
      logOpenMarkdownTarget('resolved_target', { selected, target, normalizedTargetVaultPath });

      if (currentVaultPath === normalizedTargetVaultPath && notesPath === normalizedTargetVaultPath) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedTargetVaultPath,
          notePath: target.notePath,
          absolutePath: selected,
        });
        logOpenMarkdownTarget('open_current_vault_note_result', {
          selected,
          opened,
          normalizedTargetVaultPath,
          notePath: target.notePath,
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

      if (currentVaultPath === normalizedTargetVaultPath) {
        logOpenMarkdownTarget('waiting_for_current_vault_pending_note', {
          selected,
          normalizedTargetVaultPath,
          notePath: target.notePath,
        });
        return;
      }

      const openedVault = await openVault(normalizedTargetVaultPath);
      logOpenMarkdownTarget('open_vault_result', {
        selected,
        normalizedTargetVaultPath,
        openedVault,
        vaultError: useVaultStore.getState().error,
        currentVaultPath: useVaultStore.getState().currentVault?.path ?? null,
        notesPath: useNotesStore.getState().notesPath,
      });
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog('Failed to open the selected vault.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      logOpenMarkdownTarget('error', {
        selected,
        error: error instanceof Error ? error.message : String(error),
      });
      setPendingShortcutNoteTarget(null);
      await messageDialog(error instanceof Error ? error.message : 'Failed to open the selected Markdown file.', {
        title: 'Open Failed',
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [currentVaultPath, notesPath, openShortcutNoteTarget, openVault, saveCurrentNoteIfNeeded]);

  const handleOpenSelectedFile = useCallback(async () => {
    if (isOpenTargetBusy) return;

    let selected: string | null;
    try {
      await flushCurrentTitleCommit();
      selected = getSingleOpenSelection(await openDialog({
        title: OPEN_MARKDOWN_FILE_ACTION,
        defaultPath: currentVaultPath ?? undefined,
        authorizeParentDirectory: true,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
      }));
    } catch (error) {
      console.warn('[NotesView] open markdown file dialog failed:', error);
      await messageDialog('Failed to open the file picker.', {
        title: 'Open File Failed',
        kind: 'warning',
      });
      return;
    }

    if (!selected) return;

    if (!isSupportedMarkdownSelection(selected)) {
      await messageDialog('Please select a Markdown file.', {
        title: 'Unsupported File',
        kind: 'warning',
      });
      return;
    }

    await openMarkdownTarget(selected);
  }, [currentVaultPath, isOpenTargetBusy, openMarkdownTarget]);

  useEffect(() => {
    const handleOpenMarkdownFile = () => {
      if (!active) return;
      void handleOpenSelectedFile();
    };

    window.addEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
    const unsubscribeDesktopShortcut = onDesktopOpenMarkdownFileShortcut(handleOpenMarkdownFile);
    return () => {
      window.removeEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
      unsubscribeDesktopShortcut();
    };
  }, [active, handleOpenSelectedFile]);

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
