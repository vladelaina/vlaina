import { useEffect } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { messageDialog } from '@/lib/storage/dialog';
import {
  createStarredEntry,
  getStarredEntryKey,
  getVaultStarredPaths,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  clearExternalFileTreeDropTarget,
  setExternalFileTreeDropTarget,
} from '../features/FileTree/hooks/externalFileTreeDropState';
import {
  resolveExternalFolderDropTargetPath,
  resolveStarredDropTargetFromElements,
} from '../features/FileTree/hooks/dropTargetDom';
import { createExternalDragPreview, type ExternalDragPreviewHandle } from '../features/FileTree/hooks/externalDragPreview';
import {
  importExternalMarkdownEntries,
  type ExternalMarkdownStarredTarget,
  resolveExternalMarkdownEntriesForStarred,
} from './externalMarkdownImport';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../features/Sidebar/context-menu/shared';

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

function getDroppedPaths(event: DragEvent): string[] {
  const dragDrop = getElectronBridge()?.dragDrop;
  const fileList = Array.from(event.dataTransfer?.files ?? []);
  return fileList
    .map((file) => (
      ((file as File & { path?: string }).path ?? '').trim() ||
      dragDrop?.getPathForFile(file).trim() ||
      ''
    ))
    .filter(Boolean);
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function getSidebarDropState(event: DragEvent) {
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  const isOverSidebar = elements.some((element) => (
    element instanceof HTMLElement &&
    element.closest(SIDEBAR_SCROLL_ROOT_SELECTOR)
  ));

  return {
    elements,
    isOverSidebar,
    isOverStarred: resolveStarredDropTargetFromElements(elements),
  };
}

function isActiveVaultPath(vaultPath: string) {
  return useNotesStore.getState().notesPath === vaultPath;
}

function ensureExternalDropStarredTargets(
  vaultPath: string,
  targets: ExternalMarkdownStarredTarget[]
) {
  const state = useNotesStore.getState();
  const { notesPath, starredEntries } = state;
  if (!notesPath || notesPath !== vaultPath || targets.length === 0) return;

  let updatedEntries: StarredEntry[] = starredEntries;

  for (const { kind, vaultPath: targetVaultPath, relativePath } of targets) {
    const key = getStarredEntryKey({ kind, vaultPath: targetVaultPath, relativePath });
    if (!updatedEntries.some((entry) => getStarredEntryKey(entry) === key)) {
      updatedEntries = [
        ...updatedEntries,
        createStarredEntry(kind, targetVaultPath, relativePath),
      ];
    }
  }

  if (updatedEntries === starredEntries) {
    return;
  }

  const starredPaths = getVaultStarredPaths(updatedEntries, notesPath);
  useNotesStore.setState({
    starredEntries: updatedEntries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
  });
  saveStarredRegistry(updatedEntries);
}

export function useNotesSidebarExternalDropImport({
  enabled,
  vaultPath,
  loadFileTree,
  revealFolder,
}: UseNotesSidebarExternalDropImportOptions) {
  useEffect(() => {
    if (!enabled || !vaultPath) {
      clearExternalFileTreeDropTarget();
      return;
    }

    let cancelled = false;
    let preview: ExternalDragPreviewHandle | null = null;

    const updateTarget = (event: DragEvent, paths: string[]) => {
      const clientX = event.clientX;
      const clientY = event.clientY;
      const { isOverStarred } = getSidebarDropState(event);
      const dropTargetPath = isOverStarred ? null : resolveExternalFolderDropTargetPath(clientX, clientY);
      setExternalFileTreeDropTarget(
        dropTargetPath,
        isOverStarred ? 'starred' : dropTargetPath == null ? null : 'folder',
      );

      if (paths.length > 0) {
        preview ??= createExternalDragPreview(paths);
        preview.updatePaths(paths);
        preview.updatePosition(clientX, clientY);
      }

      return {
        dropTargetPath,
        isOverStarred,
      };
    };

    const handleDragEnter = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      const dropState = getSidebarDropState(event);
      if (!isFileDrag(event) || !dropState.isOverSidebar) {
        return;
      }

      event.preventDefault();
      updateTarget(event, paths);
    };

    const handleDragOver = (event: DragEvent) => {
      const paths = getDroppedPaths(event);
      const dropState = getSidebarDropState(event);
      if (!isFileDrag(event) || !dropState.isOverSidebar) {
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
      const dropState = getSidebarDropState(event);
      if (paths.length === 0 || !dropState.isOverSidebar) {
        return;
      }

      event.preventDefault();
      const { dropTargetPath, isOverStarred } = updateTarget(event, paths);
      const importTargetPath = dropTargetPath ?? '';
      preview?.dispose();
      preview = null;
      clearExternalFileTreeDropTarget();

      void (async () => {
        if (isOverStarred) {
          const starredTargets = await resolveExternalMarkdownEntriesForStarred(vaultPath, paths);

          if (cancelled || !isActiveVaultPath(vaultPath)) {
            return;
          }

          if (starredTargets.length === 0) {
            await messageDialog(
              'Only Markdown files or folders can be added to Starred.',
              {
                title: 'Unsupported Drop',
                kind: 'warning',
              },
            );
            return;
          }

          ensureExternalDropStarredTargets(vaultPath, starredTargets);
          return;
        }

        const result = await importExternalMarkdownEntries(vaultPath, importTargetPath, paths);

        if (cancelled || !isActiveVaultPath(vaultPath)) {
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

        if (result.didImport) {
          await loadFileTree(true);
          if (cancelled || !isActiveVaultPath(vaultPath)) {
            return;
          }
        }

        const revealPath =
          result.importedFolderPaths[0] ??
          (result.importedNotePaths[0] ? getParentRelativePath(result.importedNotePaths[0]) : importTargetPath);

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
    };
  }, [enabled, loadFileTree, revealFolder, vaultPath]);
}
