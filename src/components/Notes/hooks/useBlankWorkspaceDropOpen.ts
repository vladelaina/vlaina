import { useEffect, useState } from 'react';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

interface UseBlankWorkspaceDropOpenOptions {
  enabled: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<void>;
  openVault: (path: string) => Promise<boolean>;
}

function getDroppedPaths(event: DragEvent): string[] {
  const fileList = Array.from(event.dataTransfer?.files ?? []);
  return fileList
    .map((file) => ((file as File & { path?: string }).path ?? '').trim())
    .filter(Boolean);
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

    const storage = getStorageAdapter();
    let cancelled = false;
    let preview: ExternalDragPreviewHandle | null = null;

    const handleDragEnter = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      setIsDragActive(true);
      preview ??= createExternalDragPreview(paths);
      preview.updatePaths(paths);
      preview.updatePosition(event.clientX, event.clientY);
    };

    const handleDragOver = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      setIsDragActive(true);
      preview ??= createExternalDragPreview(paths);
      preview.updatePaths(paths);
      preview.updatePosition(event.clientX, event.clientY);
    };

    const handleDragLeave = () => {
      setIsDragActive(false);
      preview?.dispose();
      preview = null;
    };

    const handleDrop = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      if (paths.length === 0) {
        return;
      }

      event.preventDefault();
      setIsDragActive(false);
      preview?.dispose();
      preview = null;

      void (async () => {
        if (paths.length !== 1) {
          await messageDialog('Drop a single folder or Markdown file to open it.', {
            title: 'Unsupported Drop',
            kind: 'warning',
          });
          return;
        }

        const droppedPath = paths[0];
        const info = await storage.stat(droppedPath);
        if (cancelled) {
          return;
        }

        if (info?.isDirectory) {
          const opened = await openVault(droppedPath);
          if (!opened && !cancelled) {
            await messageDialog('Failed to open the dropped folder.', {
              title: 'Open Failed',
              kind: 'error',
            });
          }
          return;
        }

        if (info?.isFile && isSupportedMarkdownSelection(droppedPath)) {
          await openMarkdownTarget(droppedPath);
          return;
        }

        await messageDialog('Drop a folder or a Markdown file to open it.', {
          title: 'Unsupported Drop',
          kind: 'warning',
        });
      })();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      cancelled = true;
      setIsDragActive(false);
      preview?.dispose();
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [enabled, openMarkdownTarget, openVault]);

  return isDragActive;
}
