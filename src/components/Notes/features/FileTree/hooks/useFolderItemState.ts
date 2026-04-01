import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import type { NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';
import { getSidebarMenuPositionFromTriggerRect } from '../../common/sidebarMenuPosition';
import { isInvalidMoveTarget } from '@/stores/notes/utils/fs/moveValidation';
import { scrollSidebarItemIntoView } from '../../common/sidebarScrollIntoView';

export function useFolderItemState(node: FolderNode) {
  const toggleFolder = useNotesStore((state) => state.toggleFolder);
  const deleteFolder = useNotesStore((state) => state.deleteFolder);
  const renameFolder = useNotesStore((state) => state.renameFolder);
  const createNote = useNotesStore((state) => state.createNote);
  const moveItem = useNotesStore((state) => state.moveItem);
  const newlyCreatedFolderPath = useNotesStore((state) => state.newlyCreatedFolderPath);
  const clearNewlyCreatedFolder = useNotesStore((state) => state.clearNewlyCreatedFolder);
  const toggleFolderStarred = useNotesStore((state) => state.toggleFolderStarred);
  const isFolderStarred = useNotesStore((state) => state.isFolderStarred);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (isRenaming) return;
    setRenameValue(node.name);
  }, [isRenaming, node.name]);

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

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ top: event.clientY, left: event.clientX });
    setShowMenu(true);
  }, []);

  const handleMenuTrigger = useCallback((_event: React.MouseEvent, rect: DOMRect) => {
    setMenuPosition(getSidebarMenuPositionFromTriggerRect(rect));
    setShowMenu((prev) => !prev);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      await renameFolder(node.path, trimmedValue);
    }
    setIsRenaming(false);
  }, [node.name, node.path, renameFolder, renameValue]);

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData('text/plain', node.path);
      event.dataTransfer.effectAllowed = 'move';
    },
    [node.path]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const sourcePath = event.dataTransfer.getData('text/plain');
      if (!sourcePath || isInvalidMoveTarget(sourcePath, node.path)) {
        return;
      }

      await moveItem(sourcePath, node.path);
    },
    [moveItem, node.path]
  );

  const dragHandlers: NotesSidebarRowDragHandlers = {
    draggable: !isRenaming,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

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
    dragHandlers,
    createNote,
    deleteFolder,
    toggleFolderStarred,
  };
}
