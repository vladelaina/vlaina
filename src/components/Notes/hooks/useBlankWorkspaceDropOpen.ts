import { useEffect, useState } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getStorageAdapter, type FileInfo } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../features/Sidebar/context-menu/shared';

interface UseBlankWorkspaceDropOpenOptions {
  enabled: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<void>;
  openVault: (path: string) => Promise<boolean>;
}

function describeDroppedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.files ?? []).map((file) => {
    const legacyPath = ((file as File & { path?: string }).path ?? '').trim();
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      hasLegacyPath: legacyPath.length > 0,
      legacyPath,
    };
  });
}

function getDroppedPaths(event: DragEvent): string[] {
  const dragDrop = getElectronBridge()?.dragDrop;
  const fileList = Array.from(event.dataTransfer?.files ?? []);
  return fileList
    .map((file) => {
      const legacyPath = ((file as File & { path?: string }).path ?? '').trim();
      if (legacyPath) {
        return legacyPath;
      }

      try {
        return dragDrop?.getPathForFile(file).trim() || '';
      } catch (error) {
        logNotesDebug('blankWorkspaceDrop:getPathForFileError', {
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return '';
      }
    })
    .filter(Boolean);
}

function getDataTransferTypes(event: DragEvent): string[] {
  return Array.from(event.dataTransfer?.types ?? []);
}

function hasExternalFiles(event: DragEvent): boolean {
  return getDataTransferTypes(event).includes('Files') || (event.dataTransfer?.files?.length ?? 0) > 0;
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
      const externalFiles = hasExternalFiles(event);
      const paths = getDroppedPaths(event);

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
      const externalFiles = hasExternalFiles(event);
      const paths = getDroppedPaths(event);

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
      const externalFiles = hasExternalFiles(event);
      const paths = getDroppedPaths(event);

      logNotesDebug('blankWorkspaceDrop:drop', {
        externalFiles,
        overNotesSidebar,
        types: getDataTransferTypes(event),
        fileCount: event.dataTransfer?.files?.length ?? 0,
        files: describeDroppedFiles(event),
        paths,
        hasElectronBridge: Boolean(getElectronBridge()),
        hasDragDropBridge: Boolean(getElectronBridge()?.dragDrop),
      });

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
          await messageDialog('Failed to read the dropped file path.', {
            title: 'Open Failed',
            kind: 'error',
          });
          return;
        }

        if (paths.length !== 1) {
          await messageDialog('Drop a single folder or Markdown file to open it.', {
            title: 'Unsupported Drop',
            kind: 'warning',
          });
          return;
        }

        try {
          const droppedPath = paths[0];
          logNotesDebug('blankWorkspaceDrop:statStart', { droppedPath });
          const info = await statDroppedPath(droppedPath);
          logNotesDebug('blankWorkspaceDrop:statResult', {
            droppedPath,
            info,
          });
          if (cancelled) {
            return;
          }

          if (info?.isDirectory) {
            logNotesDebug('blankWorkspaceDrop:openVault', { droppedPath });
            const opened = await openVault(droppedPath);
            logNotesDebug('blankWorkspaceDrop:openVaultResult', { droppedPath, opened });
            if (!opened && !cancelled) {
              await messageDialog('Failed to open the dropped folder.', {
                title: 'Open Failed',
                kind: 'error',
              });
            }
            return;
          }

          if (info?.isFile && isSupportedMarkdownSelection(droppedPath)) {
            logNotesDebug('blankWorkspaceDrop:openMarkdownTarget', { droppedPath });
            await openMarkdownTarget(droppedPath);
            return;
          }

          await messageDialog('Drop a folder or a Markdown file to open it.', {
            title: 'Unsupported Drop',
            kind: 'warning',
          });
        } catch (error) {
          logNotesDebug('blankWorkspaceDrop:openError', {
            error: error instanceof Error ? error.message : String(error),
          });
          if (!cancelled) {
            await messageDialog(error instanceof Error ? error.message : 'Failed to open the dropped file.', {
              title: 'Open Failed',
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
  }, [enabled, openMarkdownTarget, openVault]);

  return isDragActive;
}
