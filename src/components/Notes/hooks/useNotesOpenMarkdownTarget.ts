import { useCallback, useEffect, useState } from 'react';
import { messageDialog } from '@/lib/storage/dialog';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { normalizeNotesRootPath } from '@/stores/notesRootConfig';
import {
  isSupportedMarkdownSelection,
  resolveOpenNoteTarget,
} from '../features/OpenTarget/openTargetSelection';
import { subscribeOpenMarkdownTargetEvent } from '../features/OpenTarget/openTargetEvents';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';
import { useNotesOpenTargetPicker } from './useNotesOpenTargetPicker';
import { useI18n } from '@/lib/i18n';
import { normalizeUserFacingErrorMessage } from '@/lib/i18n/userFacingErrors';
import { toNotesRootRelativePath } from './notesExternalSyncUtils';

export function useNotesOpenMarkdownTarget({
  active,
  currentNotesRootPath,
  notesPath,
  currentNotePath,
  isDirty,
  saveNote,
  openNote,
  openNoteByAbsolutePath,
  adoptAbsoluteNoteIntoNotesRoot,
  openNotesRoot,
}: {
  active: boolean;
  currentNotesRootPath: string | null;
  notesPath: string;
  currentNotePath: string | undefined;
  isDirty: boolean;
  saveNote: () => Promise<void>;
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string) => Promise<void>;
  adoptAbsoluteNoteIntoNotesRoot: (absolutePath: string, notePath: string) => boolean;
  openNotesRoot: (path: string, name?: string, options?: { preserveSidebarTree?: boolean }) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [isOpenTargetBusy, setIsOpenTargetBusy] = useState(false);
  const [pendingShortcutNoteTarget, setPendingShortcutNoteTarget] = useState<{
    notesRootPath: string;
    notePath: string;
    absolutePath: string;
    startedAt: number;
  } | null>(null);

  const openShortcutNoteTarget = useCallback(async (target: {
    notesRootPath: string;
    notePath: string;
    absolutePath: string;
  }) => {
    const store = useNotesStore.getState();
    const activeNotesPath = store.notesPath;
    const currentPath = store.currentNote?.path;

    if (activeNotesPath === target.notesRootPath && currentPath === target.absolutePath) {
      const adopted = adoptAbsoluteNoteIntoNotesRoot(target.absolutePath, target.notePath);
      if (adopted) return true;
    }

    if (activeNotesPath === target.notesRootPath) {
      await openNote(target.notePath);
      const openedPath = useNotesStore.getState().currentNote?.path;
      if (openedPath === target.notePath) return true;
    }

    await openNoteByAbsolutePath(target.absolutePath);
    const openedPath = useNotesStore.getState().currentNote?.path;
    return openedPath === target.absolutePath || openedPath === target.notePath;
  }, [adoptAbsoluteNoteIntoNotesRoot, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!pendingShortcutNoteTarget || !currentNotesRootPath) return;
    if (currentNotesRootPath !== pendingShortcutNoteTarget.notesRootPath) return;
    if (normalizeNotesRootPath(notesPath) !== pendingShortcutNoteTarget.notesRootPath) return;

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

    void openPendingShortcutNote().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [currentNotesRootPath, notesPath, openShortcutNoteTarget, pendingShortcutNoteTarget, t]);

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
      return false;
    }

    let target: ReturnType<typeof resolveOpenNoteTarget>;
    try {
      target = resolveOpenNoteTarget(selected);
    } catch (error) {
      await messageDialog(normalizeUserFacingErrorMessage(error, 'notes.openMarkdownFileFailed'), {
        title: t('notes.openFailed'),
        kind: 'error',
      });
      return false;
    }

    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        return false;
      }

      const targetNotePath = target.notePath;
      const normalizedTargetNotesRootPath = normalizeNotesRootPath(target.notesRootPath);
      const normalizedCurrentNotesRootPath = currentNotesRootPath ? normalizeNotesRootPath(currentNotesRootPath) : null;
      const normalizedNotesPath = notesPath ? normalizeNotesRootPath(notesPath) : '';
      const currentNotesRootRelativePath = normalizedCurrentNotesRootPath && normalizedNotesPath === normalizedCurrentNotesRootPath
        ? toNotesRootRelativePath(normalizedNotesPath, selected)
        : null;

      if (currentNotesRootRelativePath && isSupportedMarkdownSelection(currentNotesRootRelativePath)) {
        const currentNotesRootPathForTarget = normalizedCurrentNotesRootPath;
        if (!currentNotesRootPathForTarget) return false;
        const opened = await openShortcutNoteTarget({
          notesRootPath: currentNotesRootPathForTarget,
          notePath: currentNotesRootRelativePath,
          absolutePath: selected,
        });
        if (!opened) {
          await messageDialog(t('notes.openMarkdownFileFailed'), {
            title: t('notes.openFailed'),
            kind: 'error',
          });
        }
        return opened;
      }

      if (normalizedCurrentNotesRootPath === normalizedTargetNotesRootPath && normalizedNotesPath === normalizedTargetNotesRootPath) {
        const opened = await openShortcutNoteTarget({
          notesRootPath: normalizedTargetNotesRootPath,
          notePath: targetNotePath,
          absolutePath: selected,
        });
        if (!opened) {
          await messageDialog(t('notes.openMarkdownFileFailed'), {
            title: t('notes.openFailed'),
            kind: 'error',
          });
        }
        return opened;
      }

      setPendingShortcutNoteTarget({
        notesRootPath: normalizedTargetNotesRootPath,
        notePath: targetNotePath,
        absolutePath: selected,
        startedAt: performance.now(),
      });

      const openedNotesRoot = await openNotesRoot(normalizedTargetNotesRootPath, undefined, {
        preserveSidebarTree: false,
      });
      if (!openedNotesRoot) {
        setPendingShortcutNoteTarget(null);
        const opened = await openShortcutNoteTarget({
          notesRootPath: normalizedTargetNotesRootPath,
          notePath: targetNotePath,
          absolutePath: selected,
        });
        if (!opened) {
          await messageDialog(t('notes.openMarkdownFileFailed'), {
            title: t('notes.openFailed'),
            kind: 'error',
          });
        }
        return opened;
      }
      return true;
    } catch (error) {
      setPendingShortcutNoteTarget(null);
      await messageDialog(normalizeUserFacingErrorMessage(error, 'notes.openMarkdownFileFailed'), {
        title: t('notes.openFailed'),
        kind: 'error',
      });
      return false;
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [currentNotesRootPath, notesPath, openShortcutNoteTarget, openNotesRoot, saveCurrentNoteIfNeeded, t]);

  const openFolderTarget = useCallback(async (selected: string) => {
    setIsOpenTargetBusy(true);
    try {
      await flushCurrentTitleCommit();

      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) {
        return false;
      }

      const openedNotesRoot = await openNotesRoot(selected);
      if (!openedNotesRoot) {
        await messageDialog(t('notesRoot.openFolderFailed'), {
          title: t('notes.openFailed'),
          kind: 'error',
        });
      }
      return openedNotesRoot;
    } catch (error) {
      await messageDialog(normalizeUserFacingErrorMessage(error, 'notesRoot.openFolderFailed'), {
        title: t('notes.openFailed'),
        kind: 'error',
      });
      return false;
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [openNotesRoot, saveCurrentNoteIfNeeded, t]);

  useNotesOpenTargetPicker({
    active,
    currentNotesRootPath,
    isOpenTargetBusy,
    openMarkdownTarget,
    openFolderTarget,
  });

  useEffect(() => {
    return subscribeOpenMarkdownTargetEvent((absolutePath) => {
      void openMarkdownTarget(absolutePath).catch(() => undefined);
    });
  }, [openMarkdownTarget]);

  return {
    isOpenTargetBusy,
    openMarkdownTarget,
    pendingOpenMarkdownTargetNotesRootPath: pendingShortcutNoteTarget?.notesRootPath ?? null,
    openStoredNotePath,
  };
}
