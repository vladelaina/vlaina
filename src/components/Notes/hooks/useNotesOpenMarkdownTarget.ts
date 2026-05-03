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
    if (!isDirty) return true;
    if (isDraftNotePath(currentNotePath)) return true;
    await saveNote();
    return !useNotesStore.getState().isDirty;
  }, [currentNotePath, isDirty, saveNote]);

  const openMarkdownTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        return;
      }

      const target = resolveOpenNoteTarget(selected);
      const normalizedTargetVaultPath = normalizeVaultPath(target.vaultPath);

      if (currentVaultPath === normalizedTargetVaultPath && notesPath === normalizedTargetVaultPath) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedTargetVaultPath,
          notePath: target.notePath,
          absolutePath: selected,
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
        return;
      }

      const openedVault = await openVault(normalizedTargetVaultPath);
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog('Failed to open the selected vault.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      setPendingShortcutNoteTarget(null);
      await messageDialog(error instanceof Error ? error.message : 'Failed to open the selected Markdown file.', {
        title: 'Open Failed',
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [currentVaultPath, notesPath, openShortcutNoteTarget, openVault, saveCurrentNoteIfNeeded]);

  const openFolderTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        return;
      }

      const openedVault = await openVault(selected);
      if (!openedVault) {
        await messageDialog('Failed to open the selected folder.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      await messageDialog(error instanceof Error ? error.message : 'Failed to open the selected folder.', {
        title: 'Open Failed',
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [openVault, saveCurrentNoteIfNeeded]);

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
