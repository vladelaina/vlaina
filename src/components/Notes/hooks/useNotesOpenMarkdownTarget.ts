import { useCallback, useEffect, useState } from 'react';
import { messageDialog } from '@/lib/storage/dialog';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { normalizeVaultPath } from '@/stores/vaultConfig';
import {
  isSupportedMarkdownSelection,
  resolveOpenNoteTarget,
} from '../features/OpenTarget/openTargetSelection';
import { subscribeOpenMarkdownTargetEvent } from '../features/OpenTarget/openTargetEvents';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';
import { useNotesOpenTargetPicker } from './useNotesOpenTargetPicker';
import { useI18n } from '@/lib/i18n';
import { toVaultRelativePath } from './notesExternalSyncUtils';

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
  openVault: (path: string, name?: string, options?: { preserveSidebarTree?: boolean }) => Promise<boolean>;
}) {
  const { t } = useI18n();
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
        await messageDialog(t('notes.openMarkdownFileFailed'), {
          title: t('notes.openFailed'),
          kind: 'error',
        });
      }
    };

    void openPendingShortcutNote();

    return () => {
      cancelled = true;
    };
  }, [currentVaultPath, openShortcutNoteTarget, pendingShortcutNoteTarget, t]);

  const saveCurrentNoteIfNeeded = useCallback(async () => {
    if (!isDirty) return true;
    if (isDraftNotePath(currentNotePath)) return true;
    await saveNote();
    return true;
  }, [currentNotePath, isDirty, saveNote]);

  const openMarkdownTarget = useCallback(async (selected: string) => {
    if (!isSupportedMarkdownSelection(selected)) {
      await messageDialog(t('notes.selectMarkdownFile'), {
        title: t('notes.unsupportedFile'),
        kind: 'warning',
      });
      return;
    }

    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        return;
      }

      const target = resolveOpenNoteTarget(selected);
      const normalizedTargetVaultPath = normalizeVaultPath(target.vaultPath);
      const normalizedCurrentVaultPath = currentVaultPath ? normalizeVaultPath(currentVaultPath) : null;
      const normalizedNotesPath = notesPath ? normalizeVaultPath(notesPath) : '';
      const currentVaultRelativePath = normalizedCurrentVaultPath && normalizedNotesPath === normalizedCurrentVaultPath
        ? toVaultRelativePath(normalizedNotesPath, selected)
        : null;

      if (currentVaultRelativePath && isSupportedMarkdownSelection(currentVaultRelativePath)) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedCurrentVaultPath,
          notePath: currentVaultRelativePath,
          absolutePath: selected,
        });
        if (!opened) {
          await messageDialog(t('notes.openMarkdownFileFailed'), {
            title: t('notes.openFailed'),
            kind: 'error',
          });
        }
        return;
      }

      if (normalizedCurrentVaultPath === normalizedTargetVaultPath && normalizedNotesPath === normalizedTargetVaultPath) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedTargetVaultPath,
          notePath: target.notePath,
          absolutePath: selected,
        });
        if (!opened) {
          await messageDialog(t('notes.openMarkdownFileFailed'), {
            title: t('notes.openFailed'),
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

      if (normalizedCurrentVaultPath === normalizedTargetVaultPath) {
        return;
      }

      const openedVault = await openVault(normalizedTargetVaultPath, undefined, {
        preserveSidebarTree: false,
      });
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog(t('vault.openFailed'), {
          title: t('notes.openFailed'),
          kind: 'error',
        });
      }
    } catch (error) {
      setPendingShortcutNoteTarget(null);
      await messageDialog(error instanceof Error ? error.message : t('notes.openMarkdownFileFailed'), {
        title: t('notes.openFailed'),
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [currentVaultPath, notesPath, openShortcutNoteTarget, openVault, saveCurrentNoteIfNeeded, t]);

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
        await messageDialog(t('vault.openFolderFailed'), {
          title: t('notes.openFailed'),
          kind: 'error',
        });
      }
    } catch (error) {
      await messageDialog(error instanceof Error ? error.message : t('vault.openFolderFailed'), {
        title: t('notes.openFailed'),
        kind: 'error',
      });
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [openVault, saveCurrentNoteIfNeeded, t]);

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
