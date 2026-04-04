import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { getSidebarContextMenuPosition, getSidebarMenuPositionFromTriggerRect } from '../../common/sidebarMenuPosition';
import { registerSidebarHoverRenameTarget } from '../../common/sidebarHoverRename';

interface UseTreeItemUiStateOptions {
  path: string;
  name: string;
}

export function useTreeItemUiState({ path, name }: UseTreeItemUiStateOptions) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isRenamingRef = useRef(false);

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
    setMenuPosition(getSidebarContextMenuPosition(event.currentTarget.getBoundingClientRect(), event.clientY));
    setShowMenu(true);
  }, []);

  const handleMenuTrigger = useCallback((_event: React.MouseEvent, rect: DOMRect) => {
    setMenuPosition(getSidebarMenuPositionFromTriggerRect(rect));
    setShowMenu((prev) => !prev);
  }, []);

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
    handleContextMenu,
    handleMenuTrigger,
  };
}
