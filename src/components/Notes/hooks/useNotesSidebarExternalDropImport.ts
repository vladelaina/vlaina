import { useEffect } from 'react';
import { messageDialog } from '@/lib/storage/dialog';
import { logNotesDebug } from '@/stores/notes/debugLog';
import {
  clearExternalFileTreeDropTarget,
  setExternalFileTreeDropTarget,
} from '../features/FileTree/hooks/externalFileTreeDropState';
import { resolveExternalFolderDropTargetPath } from '../features/FileTree/hooks/dropTargetDom';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import { importExternalMarkdownEntries } from './externalMarkdownImport';

interface UseNotesSidebarExternalDropImportOptions {
  enabled: boolean;
  vaultPath: string;
  loadFileTree: (skipRestore?: boolean) => Promise<void>;
  revealFolder: (path: string) => void;
}

function getParentRelativePath(path: string) {
  const lastSlashIndex = path.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : path.slice(0, lastSlashIndex);
}

function logExternalDrop(event: string, details: Record<string, unknown>) {
  logNotesDebug(`useNotesSidebarExternalDropImport:${event}`, details);
}

function getDroppedPaths(event: DragEvent): string[] {
  const fileList = Array.from(event.dataTransfer?.files ?? []);
  return fileList
    .map((file) => ((file as File & { path?: string }).path ?? '').trim())
    .filter(Boolean);
}

export function useNotesSidebarExternalDropImport({
  enabled,
  vaultPath,
  loadFileTree,
  revealFolder,
}: UseNotesSidebarExternalDropImportOptions) {
  useEffect(() => {
    if (!enabled || !vaultPath) {
      logExternalDrop('disabled', { enabled, vaultPath });
      clearExternalFileTreeDropTarget();
      return;
    }

    logExternalDrop('enabled', { vaultPath });

    let cancelled = false;
    let preview: ExternalDragPreviewHandle | null = null;

    const updateTarget = (event: DragEvent, paths: string[]) => {
      const clientX = event.clientX;
      const clientY = event.clientY;
      const dropTargetPath = resolveExternalFolderDropTargetPath(clientX, clientY);
      setExternalFileTreeDropTarget(dropTargetPath);

      preview ??= createExternalDragPreview(paths);
      preview.updatePaths(paths);
      preview.updatePosition(clientX, clientY);

      logExternalDrop('drag-over', {
        vaultPath,
        dropTargetPath,
        paths,
        clientX,
        clientY,
      });

      return dropTargetPath;
    };

    const handleDragEnter = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      updateTarget(event, paths);
    };

    const handleDragOver = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      updateTarget(event, paths);
    };

    const handleDragLeave = () => {
      preview?.dispose();
      preview = null;
      clearExternalFileTreeDropTarget();
    };

    const handleDrop = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      const dropTargetPath = updateTarget(event, paths) ?? '';
      preview?.dispose();
      preview = null;
      clearExternalFileTreeDropTarget();

      void (async () => {
        const result = await importExternalMarkdownEntries(vaultPath, dropTargetPath, paths);

        logExternalDrop('import-finished', {
          vaultPath,
          dropTargetPath,
          importedNotePaths: result.importedNotePaths,
          importedFolderPaths: result.importedFolderPaths,
        });

        if (cancelled) {
          logExternalDrop('import-cancelled', {
            vaultPath,
            dropTargetPath,
          });
          return;
        }

        if (result.importedNotePaths.length === 0 && result.importedFolderPaths.length === 0) {
          logExternalDrop('import-rejected:unsupported', {
            vaultPath,
            dropTargetPath,
            paths,
          });
          await messageDialog(
            'Only Markdown files or folders containing Markdown can be dropped into the current vault.',
            {
              title: 'Unsupported Drop',
              kind: 'warning',
            },
          );
          return;
        }

        await loadFileTree(true);
        if (cancelled) {
          logExternalDrop('reload-cancelled', {
            vaultPath,
            dropTargetPath,
          });
          return;
        }

        const revealPath =
          result.importedFolderPaths[0] ??
          (result.importedNotePaths[0] ? getParentRelativePath(result.importedNotePaths[0]) : dropTargetPath);

        logExternalDrop('reveal-folder', {
          revealPath,
          dropTargetPath,
        });
        revealFolder(revealPath);
      })();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      cancelled = true;
      preview?.dispose();
      clearExternalFileTreeDropTarget();
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      logExternalDrop('listener-disposed', { vaultPath });
    };
  }, [enabled, loadFileTree, revealFolder, vaultPath]);
}
