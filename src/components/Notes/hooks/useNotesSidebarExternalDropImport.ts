import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import {
  clearExternalFileTreeDropTarget,
  setExternalFileTreeDropTarget,
} from '../features/FileTree/hooks/externalFileTreeDropState';
import { resolveExternalFolderDropTargetPath } from '../features/FileTree/hooks/dropTargetDom';
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

export function useNotesSidebarExternalDropImport({
  enabled,
  vaultPath,
  loadFileTree,
  revealFolder,
}: UseNotesSidebarExternalDropImportOptions) {
  useEffect(() => {
    if (!enabled || !vaultPath || !isTauri()) {
      clearExternalFileTreeDropTarget();
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        const dropTargetPath = resolveExternalFolderDropTargetPath(
          event.payload.position.x,
          event.payload.position.y,
        );
        setExternalFileTreeDropTarget(dropTargetPath);
        return;
      }

      if (event.payload.type === 'leave') {
        clearExternalFileTreeDropTarget();
        return;
      }

      if (event.payload.type !== 'drop') {
        return;
      }

      const dropTargetPath = resolveExternalFolderDropTargetPath(
        event.payload.position.x,
        event.payload.position.y,
      );
      const { paths } = event.payload;

      clearExternalFileTreeDropTarget();

      if (!dropTargetPath && dropTargetPath !== '') {
        return;
      }

      void (async () => {
        const result = await importExternalMarkdownEntries(
          vaultPath,
          dropTargetPath,
          paths,
        );

        if (cancelled) {
          return;
        }

        if (result.importedNotePaths.length === 0 && result.importedFolderPaths.length === 0) {
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
          return;
        }

        const revealPath =
          result.importedFolderPaths[0] ??
          (result.importedNotePaths[0] ? getParentRelativePath(result.importedNotePaths[0]) : dropTargetPath);

        revealFolder(revealPath);
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
      clearExternalFileTreeDropTarget();
      unlisten?.();
    };
  }, [enabled, loadFileTree, revealFolder, vaultPath]);
}
