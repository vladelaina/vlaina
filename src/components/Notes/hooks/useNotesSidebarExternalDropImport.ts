import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@/lib/storage/adapter';
import { messageDialog } from '@/lib/storage/dialog';
import { logNotesDebug } from '@/stores/notes/debugLog';
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

function logExternalDrop(event: string, details: Record<string, unknown>) {
  logNotesDebug(`useNotesSidebarExternalDropImport:${event}`, details);
}

export function useNotesSidebarExternalDropImport({
  enabled,
  vaultPath,
  loadFileTree,
  revealFolder,
}: UseNotesSidebarExternalDropImportOptions) {
  useEffect(() => {
    if (!enabled || !vaultPath || !isTauri()) {
      logExternalDrop('disabled', {
        enabled,
        vaultPath,
        isTauri: isTauri(),
      });
      clearExternalFileTreeDropTarget();
      return;
    }

    logExternalDrop('enabled', { vaultPath });

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow().onDragDropEvent((event) => {
      logExternalDrop('window-event', {
        type: event.payload.type,
        position: 'position' in event.payload ? event.payload.position : null,
        paths: 'paths' in event.payload ? event.payload.paths : null,
      });

      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        const dropTargetPath = resolveExternalFolderDropTargetPath(
          event.payload.position.x,
          event.payload.position.y,
        );
        logExternalDrop('hover-target', {
          type: event.payload.type,
          x: event.payload.position.x,
          y: event.payload.position.y,
          dropTargetPath,
        });
        setExternalFileTreeDropTarget(dropTargetPath);
        return;
      }

      if (event.payload.type === 'leave') {
        logExternalDrop('leave', {});
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

      logExternalDrop('drop-resolved', {
        x: event.payload.position.x,
        y: event.payload.position.y,
        dropTargetPath,
        paths,
      });

      clearExternalFileTreeDropTarget();

      if (!dropTargetPath && dropTargetPath !== '') {
        logExternalDrop('drop-aborted:no-target', {
          x: event.payload.position.x,
          y: event.payload.position.y,
          paths,
        });
        return;
      }

      void (async () => {
        logExternalDrop('import-start', {
          vaultPath,
          dropTargetPath,
          paths,
        });
        const result = await importExternalMarkdownEntries(
          vaultPath,
          dropTargetPath,
          paths,
        );

        logExternalDrop('import-result', {
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
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
      logExternalDrop('listener-ready', { vaultPath });
    });

    return () => {
      cancelled = true;
      clearExternalFileTreeDropTarget();
      unlisten?.();
      logExternalDrop('listener-disposed', { vaultPath });
    };
  }, [enabled, loadFileTree, revealFolder, vaultPath]);
}
