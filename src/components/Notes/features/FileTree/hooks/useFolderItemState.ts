import { useCallback, useEffect } from 'react';
import type React from 'react';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { scrollSidebarItemIntoView } from '../../common/sidebarScrollIntoView';
import { useTreeItemUiState } from './useTreeItemUiState';
import { useTreeItemDragSource } from './useTreeItemDragSource';
import { useFolderDropTarget } from './useFolderDropTarget';

export function useFolderItemState(node: FolderNode, dragEnabled = true) {
  const toggleFolder = useNotesStore((state) => state.toggleFolder);
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
  const dragSourceHandlers = useTreeItemDragSource(node.path, isRenaming || !dragEnabled);
  const { isDragOver } = useFolderDropTarget(node.path, dragEnabled);

  useEffect(() => {
    if (node.path !== newlyCreatedFolderPath) return;
    scrollSidebarItemIntoView(node.path);
    setIsRenaming(true);
    setRenameValue(node.name);
    clearNewlyCreatedFolder();
  }, [clearNewlyCreatedFolder, newlyCreatedFolderPath, node.name, node.path]);

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
