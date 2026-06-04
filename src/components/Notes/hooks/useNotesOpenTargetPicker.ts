import { useCallback, useEffect } from 'react';
import { onDesktopOpenMarkdownFile, onDesktopOpenMarkdownFileShortcut } from '@/lib/desktop/shortcuts';
import { getElectronBridge } from '@/lib/electron/bridge';
import { messageDialog, openDialog } from '@/lib/storage/dialog';
import { useI18n } from '@/lib/i18n';
import { useUIStore } from '@/stores/uiSlice';
import {
  getSingleOpenSelection,
  isSupportedMarkdownSelection,
} from '../features/OpenTarget/openTargetSelection';
import { flushCurrentTitleCommit } from '../features/Editor/utils/titleCommitRegistry';

const OPEN_MARKDOWN_TARGET_FILE_EVENT = 'app-open-markdown-target-file';
const OPEN_MARKDOWN_TARGET_FOLDER_EVENT = 'app-open-markdown-target-folder';

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
    const handleDesktopOpenMarkdownFile = async (filePath: string) => {
      if (isOpenTargetBusy) return;
      setAppViewMode('notes');
      if (!isSupportedMarkdownSelection(filePath)) {
        await messageDialog(t('notes.selectMarkdownFile'), {
          title: t('notes.unsupportedFile'),
          kind: 'warning',
        });
        return;
      }

      try {
        const dragDrop = getElectronBridge()?.dragDrop;
        if (!dragDrop?.authorizePath) {
          throw new Error('Desktop file authorization is unavailable.');
        }
        const fileInfo = await dragDrop.authorizePath(filePath);
        if (!fileInfo?.isFile) {
          throw new Error('Selected markdown target is not a file.');
        }
      } catch {
        await messageDialog(t('notes.openMarkdownFileFailed'), {
          title: t('notes.openFailed'),
          kind: 'error',
        });
        return;
      }

      await openMarkdownTarget(filePath);
    };

    window.addEventListener('app-open-markdown-file', handleOpenMarkdownFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
    const unsubscribeDesktopShortcut = onDesktopOpenMarkdownFileShortcut(handleOpenMarkdownFile);
    const unsubscribeDesktopOpenFile = onDesktopOpenMarkdownFile(handleDesktopOpenMarkdownFile);
    return () => {
      window.removeEventListener('app-open-markdown-file', handleOpenMarkdownFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
      unsubscribeDesktopShortcut();
      unsubscribeDesktopOpenFile();
    };
  }, [active, handleOpenSelectedTarget, isOpenTargetBusy, openMarkdownTarget, setAppViewMode, t]);
}
