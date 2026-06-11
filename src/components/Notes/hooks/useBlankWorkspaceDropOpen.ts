import { useEffect, useState } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getStorageAdapter, type FileInfo } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { useI18n } from '@/lib/i18n';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../features/Sidebar/context-menu/shared';
import {
  getDroppedExternalPaths,
  hasExternalDroppedFiles,
} from './externalDropPayload';

interface UseBlankWorkspaceDropOpenOptions {
  enabled: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<void>;
  openVault: (path: string) => Promise<boolean>;
}

function isOverNotesSidebar(event: DragEvent) {
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  return elements.some((element) => (
    element instanceof HTMLElement &&
    element.closest(SIDEBAR_SCROLL_ROOT_SELECTOR)
  ));
}

async function statDroppedPath(path: string): Promise<FileInfo | null> {
  const dragDrop = getElectronBridge()?.dragDrop;
  if (dragDrop) {
    return dragDrop.authorizePath(path);
  }

  return getStorageAdapter().stat(path);
}

export function useBlankWorkspaceDropOpen({
  enabled,
  openMarkdownTarget,
  openVault,
}: UseBlankWorkspaceDropOpenOptions) {
  const { t } = useI18n();
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsDragActive(false);
      return;
    }

    let cancelled = false;
    let preview: ExternalDragPreviewHandle | null = null;

    const handleDragEnter = (event: DragEvent) => {
      const overNotesSidebar = isOverNotesSidebar(event);
      const externalFiles = hasExternalDroppedFiles(event.dataTransfer);
      const paths = getDroppedExternalPaths(event.dataTransfer);

      if (overNotesSidebar || !externalFiles) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(true);
      if (paths.length > 0) {
        preview ??= createExternalDragPreview(paths);
        preview.updatePaths(paths);
        preview.updatePosition(event.clientX, event.clientY);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      const externalFiles = hasExternalDroppedFiles(event.dataTransfer);
      const paths = getDroppedExternalPaths(event.dataTransfer);

      if (isOverNotesSidebar(event) || !externalFiles) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(true);
      if (paths.length > 0) {
        preview ??= createExternalDragPreview(paths);
        preview.updatePaths(paths);
        preview.updatePosition(event.clientX, event.clientY);
      }
    };

    const handleDragLeave = () => {
      setIsDragActive(false);
      preview?.dispose();
      preview = null;
    };

    const handleDrop = (event: DragEvent) => {
      const overNotesSidebar = isOverNotesSidebar(event);
      const externalFiles = hasExternalDroppedFiles(event.dataTransfer);
      const paths = getDroppedExternalPaths(event.dataTransfer);

      if (overNotesSidebar || !externalFiles) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);
      preview?.dispose();
      preview = null;

      void (async () => {
        if (paths.length === 0) {
          await messageDialog(t('notes.droppedPathReadFailed'), {
            title: t('notes.openFailed'),
            kind: 'error',
          });
          return;
        }

        if (paths.length !== 1) {
          await messageDialog(t('notes.dropSingleFolderOrMarkdown'), {
            title: t('notes.unsupportedDrop'),
            kind: 'warning',
          });
          return;
        }

        try {
          const droppedPath = paths[0];
          const info = await statDroppedPath(droppedPath);
          const authorizedPath = info?.path?.trim() || droppedPath;
          if (cancelled) {
            return;
          }

          if (info?.isDirectory) {
            const opened = await openVault(authorizedPath);
            if (!opened && !cancelled) {
              await messageDialog(t('notes.openDroppedFolderFailed'), {
                title: t('notes.openFailed'),
                kind: 'error',
              });
            }
            return;
          }

          if (info?.isFile && isSupportedMarkdownSelection(authorizedPath)) {
            await openMarkdownTarget(authorizedPath);
            return;
          }

          await messageDialog(t('notes.dropFolderOrMarkdown'), {
            title: t('notes.unsupportedDrop'),
            kind: 'warning',
          });
        } catch (error) {
          if (!cancelled) {
            await messageDialog(error instanceof Error ? error.message : t('notes.openDroppedFileFailed'), {
              title: t('notes.openFailed'),
              kind: 'error',
            });
          }
        }
      })();
    };

    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('dragleave', handleDragLeave, true);
    window.addEventListener('drop', handleDrop, true);

    return () => {
      cancelled = true;
      setIsDragActive(false);
      preview?.dispose();
      window.removeEventListener('dragenter', handleDragEnter, true);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
      window.removeEventListener('drop', handleDrop, true);
    };
  }, [enabled, openMarkdownTarget, openVault, t]);

  return isDragActive;
}
