import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { scrollSidebarItemIntoView } from '../../common/sidebarScrollIntoView';
import { useTreeItemUiState } from './useTreeItemUiState';
import { useTreeItemDragSource } from './useTreeItemDragSource';
import { useFolderDropTarget } from './useFolderDropTarget';

const INTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS = 120;
const EXTERNAL_FOLDER_AUTO_EXPAND_DELAY_MS = 560;
const RENAMEABLE_ROW_CLICK_DELAY_MS = 180;

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
  const clickTimerRef = useRef<number | null>(null);

  const cancelPendingClick = useCallback(() => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingClick, [cancelPendingClick]);

  useEffect(() => {
    if (node.path !== newlyCreatedFolderPath) return;
    scrollSidebarItemIntoView(node.path);
    setIsRenaming(true);
    setRenameValue(node.name);
    clearNewlyCreatedFolder();
  }, [clearNewlyCreatedFolder, newlyCreatedFolderPath, node.name, node.path]);

  useEffect(() => {
    if (autoExpandTimeoutRef.current !== null) {
      window.clearTimeout(autoExpandTimeoutRef.current);
      autoExpandTimeoutRef.current = null;
    }

    if (!isAutoExpandDragTarget || node.expanded) {
      return;
    }

    autoExpandTimeoutRef.current = window.setTimeout(() => {
      revealFolder(node.path);
      autoExpandTimeoutRef.current = null;
    }, autoExpandDelayMs);

    return () => {
      if (autoExpandTimeoutRef.current !== null) {
        window.clearTimeout(autoExpandTimeoutRef.current);
        autoExpandTimeoutRef.current = null;
      }
    };
  }, [autoExpandDelayMs, isAutoExpandDragTarget, isInternalDragOver, node.expanded, node.path, revealFolder]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      cancelPendingClick();
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        toggleFolder(node.path);
      }, RENAMEABLE_ROW_CLICK_DELAY_MS);
    },
    [cancelPendingClick, node.path, toggleFolder]
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
    cancelPendingClick,
    handleRenameSubmit,
    dragHandlers: dragSourceHandlers,
    createNote,
    deleteFolder,
    toggleFolderStarred,
  };
}
