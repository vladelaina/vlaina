import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getStorageAdapter, isTauri } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

interface UseBlankWorkspaceDropOpenOptions {
  enabled: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<void>;
  openVault: (path: string) => Promise<boolean>;
}

export function useBlankWorkspaceDropOpen({
  enabled,
  openMarkdownTarget,
  openVault,
}: UseBlankWorkspaceDropOpenOptions) {
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!enabled || !isTauri()) {
      setIsDragActive(false);
      return;
    }

    const storage = getStorageAdapter();
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragActive(true);
        return;
      }

      if (event.payload.type === 'leave') {
        setIsDragActive(false);
        return;
      }

      if (event.payload.type !== 'drop') {
        return;
      }

      setIsDragActive(false);

      const { paths } = event.payload;

      void (async () => {
        if (paths.length !== 1) {
          await messageDialog('Drop a single folder or Markdown file to open it.', {
            title: 'Unsupported Drop',
            kind: 'warning',
          });
          return;
        }

        const droppedPath = paths[0]?.trim();
        if (!droppedPath) {
          return;
        }

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
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      setIsDragActive(false);
      unlisten?.();
    };
  }, [enabled, openMarkdownTarget, openVault]);

  return isDragActive;
}
