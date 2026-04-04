import { useCallback } from 'react';
import type React from 'react';
import { useNotesStore, type NoteFile } from '@/stores/useNotesStore';
import { useTreeItemUiState } from './useTreeItemUiState';
import { useTreeItemDragSource } from './useTreeItemDragSource';

export function useFileItemState(node: NoteFile) {
  const openNote = useNotesStore((state) => state.openNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const renameNote = useNotesStore((state) => state.renameNote);
  const toggleStarred = useNotesStore((state) => state.toggleStarred);
  const isStarred = useNotesStore((state) => state.isStarred);
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
  const dragHandlers = useTreeItemDragSource(node.path, isRenaming);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      void openNote(node.path, event.ctrlKey || event.metaKey);
    },
    [node.path, openNote]
  );

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      await renameNote(node.path, trimmedValue);
    }
    setIsRenaming(false);
  }, [node.name, node.path, renameNote, renameValue]);

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
