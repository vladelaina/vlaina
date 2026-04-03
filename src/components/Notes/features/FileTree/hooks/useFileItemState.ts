import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { useNotesStore, type NoteFile } from '@/stores/useNotesStore';
import type { NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';
import { getSidebarContextMenuPosition, getSidebarMenuPositionFromTriggerRect } from '../../common/sidebarMenuPosition';

export function useFileItemState(node: NoteFile) {
  const openNote = useNotesStore((state) => state.openNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const renameNote = useNotesStore((state) => state.renameNote);
  const toggleStarred = useNotesStore((state) => state.toggleStarred);
  const isStarred = useNotesStore((state) => state.isStarred);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (isRenaming) return;
    setRenameValue(node.name);
  }, [isRenaming, node.name]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      void openNote(node.path, event.ctrlKey || event.metaKey);
    },
    [node.path, openNote]
  );

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition(getSidebarContextMenuPosition(event.currentTarget.getBoundingClientRect(), event.clientY));
    setShowMenu(true);
  }, []);

  const handleMenuTrigger = useCallback((_event: React.MouseEvent, rect: DOMRect) => {
    setMenuPosition(getSidebarMenuPositionFromTriggerRect(rect));
    setShowMenu((prev) => !prev);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      await renameNote(node.path, trimmedValue);
    }
    setIsRenaming(false);
  }, [node.name, node.path, renameNote, renameValue]);

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData('text/plain', node.path);
      event.dataTransfer.effectAllowed = 'move';
    },
    [node.path]
  );

  const dragHandlers: NotesSidebarRowDragHandlers = {
    draggable: !isRenaming,
    onDragStart: handleDragStart,
  };

  return {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    showDeleteDialog,
    setShowDeleteDialog,
    isItemStarred: isStarred(node.path),
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers,
    openNote,
    deleteNote,
    toggleStarred,
  };
}
