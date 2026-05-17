import { useCallback, useEffect } from 'react';
import { onDesktopOpenMarkdownFile, onDesktopOpenMarkdownFileShortcut } from '@/lib/desktop/shortcuts';
import { messageDialog, openDialog } from '@/lib/storage/dialog';
import { useI18n } from '@/lib/i18n';
import { useUIStore } from '@/stores/uiSlice';
import {
  getSingleOpenSelection,
  isSupportedMarkdownSelection,
} from '../features/OpenTarget/openTargetSelection';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';

const OPEN_MARKDOWN_TARGET_FILE_EVENT = 'vlaina-open-markdown-target-file';
const OPEN_MARKDOWN_TARGET_FOLDER_EVENT = 'vlaina-open-markdown-target-folder';

export function useNotesOpenTargetPicker({
  active,
  currentVaultPath,
  isOpenTargetBusy,
  openMarkdownTarget,
  openFolderTarget,
}: {
  active: boolean;
  currentVaultPath: string | null;
  isOpenTargetBusy: boolean;
  openMarkdownTarget: (selected: string) => Promise<void>;
  openFolderTarget: (selected: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const handleOpenSelectedTarget = useCallback(async (targetKind: 'file' | 'folder') => {
    if (isOpenTargetBusy) return;

    const targetLabel = targetKind === 'folder' ? t('notes.folder') : t('notes.file');
    let selected: string | null;
    try {
      await flushCurrentTitleCommit();
      selected = getSingleOpenSelection(await openDialog({
        title: targetKind === 'folder' ? t('vault.openFolder') : t('shortcut.action.openMarkdownFile'),
        defaultPath: currentVaultPath ?? undefined,
        directory: targetKind === 'folder',
        authorizeParentDirectory: targetKind === 'file',
        filters: targetKind === 'file'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]
          : undefined,
      }));
    } catch (error) {
      console.warn('[NotesView] open target picker failed:', error);
      await messageDialog(t('notes.openTargetPickerFailed', { itemType: targetLabel }), {
        title: t('notes.openTargetFailed', { itemType: targetLabel }),
        kind: 'warning',
      });
      return;
    }

    if (!selected) return;

    if (targetKind === 'folder') {
      await openFolderTarget(selected);
      return;
    }

    if (!isSupportedMarkdownSelection(selected)) {
      await messageDialog(t('notes.selectMarkdownFile'), {
        title: t('notes.unsupportedFile'),
        kind: 'warning',
      });
      return;
    }

    await openMarkdownTarget(selected);
  }, [currentVaultPath, isOpenTargetBusy, openFolderTarget, openMarkdownTarget, t]);

  useEffect(() => {
    const handleOpenMarkdownFile = () => {
      if (!active) return;
      void handleOpenSelectedTarget('file');
    };
    const handleOpenMarkdownTargetFile = () => {
      if (!active) return;
      void handleOpenSelectedTarget('file');
    };
    const handleOpenMarkdownTargetFolder = () => {
      if (!active) return;
      void handleOpenSelectedTarget('folder');
    };
    const handleDesktopOpenMarkdownFile = (filePath: string) => {
      if (isOpenTargetBusy) return;
      setAppViewMode('notes');
      void openMarkdownTarget(filePath);
    };

    window.addEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
    const unsubscribeDesktopShortcut = onDesktopOpenMarkdownFileShortcut(handleOpenMarkdownFile);
    const unsubscribeDesktopOpenFile = onDesktopOpenMarkdownFile(handleDesktopOpenMarkdownFile);
    return () => {
      window.removeEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
      unsubscribeDesktopShortcut();
      unsubscribeDesktopOpenFile();
    };
  }, [active, handleOpenSelectedTarget, isOpenTargetBusy, openMarkdownTarget, setAppViewMode]);
}
