import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NotesSidebarContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  children: ReactNode;
}

interface NotesSidebarContextMenuItemProps {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void | Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export function NotesSidebarContextMenu({
  isOpen,
  onClose,
  position,
  children,
}: NotesSidebarContextMenuProps) {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        key="overlay"
        className="fixed inset-0 z-[9998]"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <motion.div
        key="menu"
        style={{ top: position.top, left: position.left, transformOrigin: 'top left' }}
        className="fixed z-[9999] min-w-[180px] rounded-2xl border border-[var(--notes-sidebar-menu-border)] bg-[var(--notes-sidebar-menu-bg)] p-1.5 shadow-[var(--notes-sidebar-menu-shadow)]"
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

export function NotesSidebarContextMenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  trailing,
  className,
}: NotesSidebarContextMenuItemProps) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        try {
          const result = onClick();
          if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            void (result as Promise<unknown>).catch(() => undefined);
          }
        } catch {
        }
      }}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
          : 'text-[var(--notes-sidebar-text)] hover:bg-[var(--notes-sidebar-row-hover)]',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-[20px] items-center justify-center',
          danger ? 'text-red-500' : 'text-[var(--notes-sidebar-icon)]'
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {trailing ? <span className="shrink-0 text-[var(--notes-sidebar-icon)]">{trailing}</span> : null}
    </button>
  );
}

export function NotesSidebarContextMenuDivider() {
  return <div className="my-1 h-px bg-[var(--notes-sidebar-menu-border)] opacity-70" />;
}
