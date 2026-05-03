import { useEffect, type RefObject } from 'react';
import { getSidebarContextMenuPosition, type SidebarMenuPosition } from '../common/sidebarMenuPosition';

export function useRootBlankContextMenu({
  enabled,
  blankContextMenuRef,
  rootRowRef,
  onOpen,
}: {
  enabled: boolean;
  blankContextMenuRef?: RefObject<HTMLElement | null>;
  rootRowRef: RefObject<HTMLElement | null>;
  onOpen: (position: SidebarMenuPosition) => void;
}) {
  useEffect(() => {
    const blankArea = enabled ? blankContextMenuRef?.current : null;
    if (!blankArea) return;

    const handleBlankContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = rootRowRef.current?.getBoundingClientRect() ?? blankArea.getBoundingClientRect();
      onOpen(getSidebarContextMenuPosition(rect, event.clientY));
    };

    blankArea.addEventListener('contextmenu', handleBlankContextMenu);
    return () => blankArea.removeEventListener('contextmenu', handleBlankContextMenu);
  }, [blankContextMenuRef, enabled, onOpen, rootRowRef]);
}
