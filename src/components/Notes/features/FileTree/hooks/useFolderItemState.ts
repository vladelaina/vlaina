import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { scrollSidebarItemIntoView } from '../../common/sidebarScrollIntoView';
import { useTreeItemUiState } from './useTreeItemUiState';
import { useTreeItemDragSource } from './useTreeItemDragSource';
import { useFolderDropTarget } from './useFolderDropTarget';

const INTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS = 120;
const EXTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS = 560;

function logFolderAutoExpand(event: string, details: Record<string, unknown>) {
  logNotesDebug(`useFolderItemState:${event}`, details);
}

export function useFolderItemState(node: FolderNode, dragEnabled = true) {
  const toggleFolder = useNotesStore((state) => state.toggleFolder);
  const revealFolder = useNotesStore((state) => state.revealFolder);
  const deleteFolder = useNotesStore((state) => state.deleteFolder);
  const renameFolder = useNotesStore((state) => state.renameFolder);
  const createNote = useNotesStore((state) => state.createNote);
  const newlyCreatedFolderPath = useNotesStore((state) => state.newlyCreatedFolderPath);
  const clearNewlyCreatedFolder = useNotesStore((state) => state.clearNewlyCreatedFolder);
  const toggleFolderStarred = useNotesStore((state) => state.toggleFolderStarred);
  const isFolderStarred = useNotesStore((state) => state.isFolderStarred);
  const {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    showDeleteDialog,
    setShowDeleteDialog,
    handleContextMenu,
    handleMenuTrigger,
  } = useTreeItemUiState({
    path: node.path,
    name: node.name,
  });
  const dragSourceHandlers = useTreeItemDragSource(node.path, isRenaming || !dragEnabled, 'folder');
  const {
    isDragOver,
    isInternalDragOver,
    isExternalDragOver,
  } = useFolderDropTarget(node.path, dragEnabled);
  const isAutoExpandDragTarget = isInternalDragOver || isExternalDragOver;
  const autoExpandDelayMs = isInternalDragOver
    ? INTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS
    : EXTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS;
  const autoExpandTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (node.path !== newlyCreatedFolderPath) return;
    scrollSidebarItemIntoView(node.path);
    setIsRenaming(true);
    setRenameValue(node.name);
    clearNewlyCreatedFolder();
  }, [clearNewlyCreatedFolder, newlyCreatedFolderPath, node.name, node.path]);

  useEffect(() => {
    if (autoExpandTimeoutRef.current !== null) {
      logFolderAutoExpand('cancel-pending', {
        path: node.path,
        expanded: node.expanded,
      });
      window.clearTimeout(autoExpandTimeoutRef.current);
      autoExpandTimeoutRef.current = null;
    }

    if (!isAutoExpandDragTarget || node.expanded) {
      if (isAutoExpandDragTarget) {
        logFolderAutoExpand('skip-already-expanded', {
          path: node.path,
        });
      }
      return;
    }

    logFolderAutoExpand('schedule', {
      path: node.path,
      delayMs: autoExpandDelayMs,
      mode: isInternalDragOver ? 'internal' : 'external',
    });
    autoExpandTimeoutRef.current = window.setTimeout(() => {
      logFolderAutoExpand('fire', {
        path: node.path,
        mode: isInternalDragOver ? 'internal' : 'external',
      });
      revealFolder(node.path);
      autoExpandTimeoutRef.current = null;
    }, autoExpandDelayMs);

    return () => {
      if (autoExpandTimeoutRef.current !== null) {
        logFolderAutoExpand('cleanup', {
          path: node.path,
        });
        window.clearTimeout(autoExpandTimeoutRef.current);
        autoExpandTimeoutRef.current = null;
      }
    };
  }, [autoExpandDelayMs, isAutoExpandDragTarget, isInternalDragOver, node.expanded, node.path, revealFolder]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      toggleFolder(node.path);
    },
    [node.path, toggleFolder]
  );

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      await renameFolder(node.path, trimmedValue);
    }
    setIsRenaming(false);
  }, [node.name, node.path, renameFolder, renameValue]);

  return {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    isDragOver,
    showDeleteDialog,
    setShowDeleteDialog,
    isItemStarred: isFolderStarred(node.path),
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers: dragSourceHandlers,
    createNote,
    deleteFolder,
    toggleFolderStarred,
  };
}
