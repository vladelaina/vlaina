import { useCallback, useEffect } from 'react';
import { onDesktopOpenMarkdownFileShortcut } from '@/lib/desktop/shortcuts';
import { OPEN_MARKDOWN_FILE_ACTION } from '@/lib/notes/openMarkdownFileText';
import { messageDialog, openDialog } from '@/lib/storage/dialog';
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
  const handleOpenSelectedTarget = useCallback(async (targetKind: 'file' | 'folder') => {
    if (isOpenTargetBusy) return;

    const targetLabel = targetKind === 'folder' ? 'Folder' : 'File';
    let selected: string | null;
    try {
      await flushCurrentTitleCommit();
      selected = getSingleOpenSelection(await openDialog({
        title: targetKind === 'folder' ? `Open ${targetLabel}` : OPEN_MARKDOWN_FILE_ACTION,
        defaultPath: currentVaultPath ?? undefined,
        directory: targetKind === 'folder',
        authorizeParentDirectory: targetKind === 'file',
        filters: targetKind === 'file'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]
          : undefined,
      }));
    } catch (error) {
      console.warn('[NotesView] open target picker failed:', error);
      await messageDialog(`Failed to open the ${targetLabel.toLowerCase()} picker.`, {
        title: `Open ${targetLabel} Failed`,
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
      await messageDialog('Please select a Markdown file.', {
        title: 'Unsupported File',
        kind: 'warning',
      });
      return;
    }

    await openMarkdownTarget(selected);
  }, [currentVaultPath, isOpenTargetBusy, openFolderTarget, openMarkdownTarget]);

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

    window.addEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
    window.addEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
    const unsubscribeDesktopShortcut = onDesktopOpenMarkdownFileShortcut(handleOpenMarkdownFile);
    return () => {
      window.removeEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FILE_EVENT, handleOpenMarkdownTargetFile);
      window.removeEventListener(OPEN_MARKDOWN_TARGET_FOLDER_EVENT, handleOpenMarkdownTargetFolder);
      unsubscribeDesktopShortcut();
    };
  }, [active, handleOpenSelectedTarget]);
}
