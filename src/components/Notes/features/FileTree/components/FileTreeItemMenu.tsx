import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const MenuItem = React.memo(function MenuItem({ icon, label, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <span className={cn(
        "flex items-center justify-center w-4 h-4",
        danger ? "text-red-500" : "text-zinc-400 dark:text-zinc-500"
      )}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.HTMLAttributes<HTMLElement>>, { className: "w-4 h-4" }) : icon}
      </span>
      {label}
    </button>
  );
});

interface FileTreeItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  isFolder: boolean;
  isStarred: boolean;
  onRename: () => void;
  onNewNote: () => void;
  onOpenNewTab: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
}

export const FileTreeItemMenu = ({
  isOpen, onClose, position, isFolder, isStarred,
  onRename, onNewNote, onOpenNewTab, onToggleStar, onDelete
}: FileTreeItemMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            ref={menuRef}
            style={{
              top: position.top,
              left: position.left,
              transformOrigin: 'top left'
            }}
            className={cn(
              "fixed z-[9999] min-w-[220px] p-1.5 rounded-xl",
              "bg-white dark:bg-[#1e1e1e]",
              "border border-black/5 dark:border-white/10",
              "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)]"
            )}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem icon={<Icon name="common.compose" />} label="Rename" onClick={onRename} />
            <MenuItem icon={<Icon name="common.info" />} label="View Info" onClick={onClose} />
            
            {isFolder && (
              <MenuItem icon={<Icon name="file.add" />} label="New Note" onClick={onNewNote} />
            )}
            
            <MenuItem icon={<Icon name="common.copy" />} label="Duplicate" onClick={onClose} />
            <MenuItem icon={<Icon name="nav.external" />} label="Open in new tab" onClick={onOpenNewTab} />
            <MenuItem icon={<Icon name="nav.split" />} label="Open in split view" onClick={onClose} />
            
            <MenuItem 
              icon={isStarred ? <Icon name="misc.star" className="text-amber-500 fill-amber-500" /> : <Icon name="misc.star" />}
              label={isStarred ? "Remove from Favorites" : "Add to Favorites"}
              onClick={onToggleStar}
            />
            
            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1.5 mx-1" />
            
            <MenuItem icon={<Icon name="common.delete" />} label="Move to Trash" onClick={onDelete} danger />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
