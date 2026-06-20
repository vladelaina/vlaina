import { useEffect, useState } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getStorageAdapter, isAbsolutePath, normalizeAbsolutePath, type FileInfo } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { useI18n } from '@/lib/i18n';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { hasUnsafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../features/Sidebar/context-menu/shared';
import {
  getDroppedExternalPaths,
  hasExternalDroppedFiles,
} from './externalDropPayload';

const CHAT_INPUT_DROP_TARGET_SELECTOR = '[data-chat-input="true"]';

interface UseBlankWorkspaceDropOpenOptions {
  enabled: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<unknown>;
  openVault: (path: string) => Promise<boolean>;
}

function isOverNotesSidebar(event: DragEvent) {
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  return elements.some((element) => (
    element instanceof HTMLElement &&
    element.closest(SIDEBAR_SCROLL_ROOT_SELECTOR)
  ));
}

function isOverChatInput(event: DragEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.closest(CHAT_INPUT_DROP_TARGET_SELECTOR)
  ) {
    return true;
  }

  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  return elements.some((element) => (
    element instanceof HTMLElement &&
    element.closest(CHAT_INPUT_DROP_TARGET_SELECTOR)
  ));
}

async function statDroppedPath(path: string): Promise<FileInfo | null> {
  const dragDrop = getElectronBridge()?.dragDrop;
  if (dragDrop) {
    return dragDrop.authorizePath(path);
  }

  return getStorageAdapter().stat(path);
}

function getAuthorizedDroppedPath(info: FileInfo | null, fallbackPath: string) {
  return info?.path?.trim() || fallbackPath;
}

function normalizeSafeDroppedVaultPath(path: string): string | null {
  const normalizedPath = normalizeAbsolutePath(path.trim());
  if (
    !isAbsolutePath(normalizedPath) ||
    hasInternalNotePathSegment(normalizedPath) ||
    hasUnsafeVaultPathSegment(normalizedPath)
  ) {
    return null;
  }

  return normalizedPath;
}

function normalizeSafeDroppedMarkdownPath(path: string): string | null {
  const normalizedPath = normalizeSafeDroppedVaultPath(path);
  return normalizedPath && isSupportedMarkdownSelection(normalizedPath)
    ? normalizedPath
    : null;
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
      const overChatInput = isOverChatInput(event);
      const externalFiles = hasExternalDroppedFiles(event.dataTransfer);
      const paths = getDroppedExternalPaths(event.dataTransfer);

      if (overNotesSidebar || overChatInput || !externalFiles) {
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

      if (isOverNotesSidebar(event) || isOverChatInput(event) || !externalFiles) {
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
      const overChatInput = isOverChatInput(event);
      const externalFiles = hasExternalDroppedFiles(event.dataTransfer);
      const paths = getDroppedExternalPaths(event.dataTransfer);

      if (overNotesSidebar || overChatInput || !externalFiles) {
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
          const authorizedPath = getAuthorizedDroppedPath(info, droppedPath);
          if (cancelled) {
            return;
          }

          if (info?.isDirectory) {
            const authorizedVaultPath = normalizeSafeDroppedVaultPath(authorizedPath);
            if (!authorizedVaultPath) {
              await messageDialog(t('notes.dropFolderOrMarkdown'), {
                title: t('notes.unsupportedDrop'),
                kind: 'warning',
              });
              return;
            }

            const opened = await openVault(authorizedVaultPath);
            if (!opened && !cancelled) {
              await messageDialog(t('notes.openDroppedFolderFailed'), {
                title: t('notes.openFailed'),
                kind: 'error',
              });
            }
            return;
          }

          const authorizedFilePath = info?.isFile
            ? normalizeSafeDroppedMarkdownPath(authorizedPath)
            : null;
          if (authorizedFilePath) {
            await openMarkdownTarget(authorizedFilePath);
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
      })().catch(() => undefined);
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
