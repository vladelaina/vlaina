import { type ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  SidebarContextMenuDivider,
  SidebarContextMenuItem,
} from './context-menu/SidebarContextMenuParts';
import { SidebarContextMenuSubmenu } from './context-menu/SidebarContextMenuSubmenu';
import { MENU_PANEL_CLASS_NAME, VIEWPORT_MENU_MARGIN, type SidebarMenuPosition } from './context-menu/shared';
import { useMenuDismiss } from './context-menu/useMenuDismiss';
import { useResolvedMenuPosition } from './context-menu/useResolvedMenuPosition';

interface SidebarContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: SidebarMenuPosition;
  children: ReactNode;
}

export function SidebarContextMenu({
  isOpen,
  onClose,
  position,
  children,
}: SidebarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const resolvedPosition = useResolvedMenuPosition({ isOpen, menuRef, position });

  useMenuDismiss({ isOpen, onClose });

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-sidebar-context-menu-layer="true"
      style={{
        top: resolvedPosition.top,
        left: resolvedPosition.left,
        transformOrigin: 'top left',
        maxHeight: `calc(100vh - ${VIEWPORT_MENU_MARGIN * 2}px)`,
      }}
      className={cn('fixed z-[var(--vlaina-z-max)]', MENU_PANEL_CLASS_NAME)}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

export { SidebarContextMenuItem, SidebarContextMenuDivider, SidebarContextMenuSubmenu };
