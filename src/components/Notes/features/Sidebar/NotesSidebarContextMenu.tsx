import { type ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NotesSidebarContextMenuDivider, NotesSidebarContextMenuItem } from './context-menu/NotesSidebarContextMenuParts';
import { NotesSidebarContextMenuSubmenu } from './context-menu/NotesSidebarContextMenuSubmenu';
import { MENU_PANEL_CLASS_NAME, VIEWPORT_MENU_MARGIN, type NotesSidebarMenuPosition } from './context-menu/shared';
import { useMenuDismiss } from './context-menu/useMenuDismiss';
import { useResolvedMenuPosition } from './context-menu/useResolvedMenuPosition';

interface NotesSidebarContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: NotesSidebarMenuPosition;
  children: ReactNode;
}

export function NotesSidebarContextMenu({
  isOpen,
  onClose,
  position,
  children,
}: NotesSidebarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const resolvedPosition = useResolvedMenuPosition({ isOpen, menuRef, position });

  useMenuDismiss({ isOpen, onClose });

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="menu"
        ref={menuRef}
        data-notes-sidebar-context-menu-layer="true"
        style={{
          top: resolvedPosition.top,
          left: resolvedPosition.left,
          transformOrigin: 'top left',
          maxHeight: `calc(100vh - ${VIEWPORT_MENU_MARGIN * 2}px)`,
        }}
        className={cn('fixed z-[9999]', MENU_PANEL_CLASS_NAME)}
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
        transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.5 }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

export { NotesSidebarContextMenuItem, NotesSidebarContextMenuDivider, NotesSidebarContextMenuSubmenu };
