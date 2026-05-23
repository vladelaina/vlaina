import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarContextMenuItemProps {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void | Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export function SidebarContextMenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  trailing,
  className,
}: SidebarContextMenuItemProps) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        const result = onClick();
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void result;
        }
      }}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[16px] font-medium leading-none outline-none transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
          : 'text-[var(--notes-sidebar-text)] hover:bg-[var(--notes-sidebar-row-hover)]',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-[20px] shrink-0 items-center justify-center leading-none',
          danger ? 'text-red-500' : 'text-[var(--notes-sidebar-text)]',
        )}
      >
        {icon}
      </span>
      <span className="inline-flex min-w-0 flex-1 items-center truncate text-left leading-none">{label}</span>
      {trailing ? <span className="inline-flex shrink-0 items-center leading-none text-[var(--notes-sidebar-text)]">{trailing}</span> : null}
    </button>
  );
}

export function SidebarContextMenuDivider() {
  return <div className="my-1 h-px bg-[var(--notes-sidebar-menu-border)] opacity-70" />;
}
