import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarContextMenuItemProps {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void | Promise<unknown>;
  itemKey?: string;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export function SidebarContextMenuItem({
  icon,
  label,
  onClick,
  itemKey,
  danger = false,
  disabled = false,
  trailing,
  className,
}: SidebarContextMenuItemProps) {
  return (
    <button
      data-sidebar-context-menu-item={itemKey}
      onClick={(event) => {
        event.stopPropagation();
        const result = onClick();
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void result;
        }
      }}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[var(--vlaina-font-base)] font-medium leading-none outline-none transition-colors',
        danger
          ? 'text-[var(--vlaina-color-status-danger-fg)] hover:bg-[var(--vlaina-color-status-danger-bg)]'
          : 'text-[var(--vlaina-sidebar-notes-text)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)]',
        disabled && 'cursor-not-allowed opacity-[var(--vlaina-opacity-50)] hover:bg-transparent dark:hover:bg-transparent',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-[var(--vlaina-size-20px)] shrink-0 items-center justify-center leading-none',
          danger ? 'text-[var(--vlaina-color-status-danger-fg)]' : 'text-[var(--vlaina-accent)]',
        )}
      >
        {icon}
      </span>
      <span className="inline-flex min-w-0 flex-1 items-center truncate text-left leading-none">{label}</span>
      {trailing ? <span className="inline-flex shrink-0 items-center leading-none text-[var(--vlaina-sidebar-notes-text)]">{trailing}</span> : null}
    </button>
  );
}

export function SidebarContextMenuDivider() {
  return <div className="my-1 h-px bg-[var(--vlaina-sidebar-notes-menu-border)] opacity-[var(--vlaina-opacity-70)]" />;
}
