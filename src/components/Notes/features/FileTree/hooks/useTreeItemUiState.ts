import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { getSidebarContextMenuPosition } from '../../common/sidebarMenuPosition';
import { registerSidebarHoverRenameTarget } from '../../common/sidebarHoverRename';
import { getInvalidFileNameReason } from '@/stores/notes/noteUtils';
import { useToastStore } from '@/stores/useToastStore';

const INVALID_FILE_NAME_TOAST_INTERVAL_MS = 1200;

interface UseTreeItemUiStateOptions {
  path: string;
  name: string;
}

export function useTreeItemUiState({ path, name }: UseTreeItemUiStateOptions) {
  const addToast = useToastStore((state) => state.addToast);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isRenamingRef = useRef(false);
  const lastInvalidToastAtRef = useRef(0);

  useEffect(() => {
    isRenamingRef.current = isRenaming;
  }, [isRenaming]);

  useEffect(() => {
    if (isRenaming) {
      return;
    }

    setRenameValue(name);
  }, [isRenaming, name]);

  useEffect(() => {
    return registerSidebarHoverRenameTarget(path, {
      startRename: () => {
        setIsRenaming(true);
        setShowMenu(false);
      },
      cancelRename: () => {
        setIsRenaming(false);
      },
      isRenaming: () => isRenamingRef.current,
    });
  }, [path]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition(
      getSidebarContextMenuPosition(
        event.currentTarget.getBoundingClientRect(),
        event.clientY,
        event.clientX,
      ),
    );
    setShowMenu(true);
  }, []);

  const handleMenuTrigger = useCallback((event: React.MouseEvent, rect: DOMRect) => {
    setMenuPosition(getSidebarContextMenuPosition(rect, event.clientY));
    setShowMenu((prev) => !prev);
  }, []);

  const handleRenameValueChange = useCallback((value: string) => {
    const invalidReason = value.trim() ? getInvalidFileNameReason(value) : null;
    if (invalidReason) {
      const now = Date.now();
      if (now - lastInvalidToastAtRef.current >= INVALID_FILE_NAME_TOAST_INTERVAL_MS) {
        lastInvalidToastAtRef.current = now;
        addToast(invalidReason, 'error', 3500);
      }
      return;
    }

    setRenameValue(value);
  }, [addToast]);

  return {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue: handleRenameValueChange,
    showDeleteDialog,
    setShowDeleteDialog,
    handleContextMenu,
    handleMenuTrigger,
  };
}
