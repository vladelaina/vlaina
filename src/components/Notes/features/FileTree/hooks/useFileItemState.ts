import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useNotesStore, type NoteFile } from '@/stores/useNotesStore';
import { useTreeItemUiState } from './useTreeItemUiState';
import { useTreeItemDragSource } from './useTreeItemDragSource';
import { scrollCurrentNoteToTop } from '../../Editor/utils/scrollCurrentNoteToTop';

const RENAMEABLE_ROW_CLICK_DELAY_MS = 180;

export function useFileItemState(node: NoteFile, dragEnabled = true) {
  const openNote = useNotesStore((state) => state.openNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const renameNote = useNotesStore((state) => state.renameNote);
  const toggleStarred = useNotesStore((state) => state.toggleStarred);
  const isStarred = useNotesStore((state) => state.isStarred);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path);
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
  const dragHandlers = useTreeItemDragSource(node.path, isRenaming || !dragEnabled);
  const clickTimerRef = useRef<number | null>(null);

  const cancelPendingClick = useCallback(() => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingClick, [cancelPendingClick]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      cancelPendingClick();

      const openInNewTab = event.ctrlKey || event.metaKey;
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;

        if (!openInNewTab && currentNotePath === node.path) {
          scrollCurrentNoteToTop();
          return;
        }

        void openNote(node.path, openInNewTab);
      }, RENAMEABLE_ROW_CLICK_DELAY_MS);
    },
    [cancelPendingClick, currentNotePath, node.path, openNote]
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
    cancelPendingClick,
    handleRenameSubmit,
    dragHandlers,
    openNote,
    deleteNote,
    toggleStarred,
  };
}
