import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TreeItemContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  children: React.ReactNode;
}

interface TreeItemMenuActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function TreeItemContextMenu({
  isOpen,
  onClose,
  position,
  children,
}: TreeItemContextMenuProps) {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <motion.div
        style={{
          top: position.top,
          left: position.left,
          transformOrigin: 'top left',
        }}
        className={cn(
          'fixed z-[9999] min-w-[220px] rounded-xl border border-black/5 bg-white p-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#1e1e1e]'
        )}
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
        transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.5 }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export function TreeItemMenuAction({
  icon,
  label,
  onClick,
  danger = false,
}: TreeItemMenuActionProps) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      )}
    >
      <span
        className={cn(
          'flex size-[20px] items-center justify-center',
          danger ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export function TreeItemMenuDivider() {
  return <div className="my-1.5 mx-1 h-px bg-gray-100 dark:bg-zinc-800" />;
}
