import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NotesSidebarRowDragHandlers {
  draggable: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
}

interface NotesSidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  depth?: number;
  leading?: ReactNode;
  leadingClassName?: string;
  main: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  isDragOver?: boolean;
  showActionsByDefault?: boolean;
  contentClassName?: string;
  actionFadeClassName?: string;
  dragHandlers?: NotesSidebarRowDragHandlers;
}

export function NotesSidebarRow({
  depth = 0,
  leading,
  leadingClassName,
  main,
  trailing,
  actions,
  isActive = false,
  isDragOver = false,
  showActionsByDefault = false,
  className,
  contentClassName,
  actionFadeClassName,
  dragHandlers,
  children,
  ...props
}: NotesSidebarRowProps) {
  const paddingLeft = depth * 16;
  const hasActions = Boolean(actions);
  const showTrailing = Boolean(trailing) && (!hasActions || !showActionsByDefault);

  return (
    <div
      className={cn('group/notes-sidebar-row flex items-center py-[1px]', className)}
      draggable={dragHandlers?.draggable}
      onDragStart={dragHandlers?.onDragStart}
      onDragOver={dragHandlers?.onDragOver}
      onDragLeave={dragHandlers?.onDragLeave}
      onDrop={dragHandlers?.onDrop}
      {...props}
    >
      <div style={{ width: paddingLeft }} className="shrink-0" />

      <div
        className={cn(
          'relative mx-1 flex min-h-9 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out',
          isActive
            ? 'bg-[var(--notes-sidebar-row-active)] text-[var(--notes-sidebar-text)]'
            : 'text-[var(--notes-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)]',
          isDragOver && 'bg-[var(--notes-sidebar-row-drag)] ring-1 ring-[var(--neko-accent)]'
        )}
      >
        {leading ? (
          <span className={cn('flex size-[20px] shrink-0 items-center justify-center', leadingClassName)}>
            {leading}
          </span>
        ) : null}

        <div className={cn('relative z-10 min-w-0 flex-1', hasActions && 'pr-8', contentClassName)}>
          {main}
        </div>

        {showTrailing ? (
          <div
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-150',
              hasActions && 'group-hover/notes-sidebar-row:opacity-0'
            )}
          >
            {trailing}
          </div>
        ) : null}

        {hasActions ? (
          <div
            className={cn(
              'absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center transition-opacity duration-150',
              showActionsByDefault
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0 group-hover/notes-sidebar-row:pointer-events-auto group-hover/notes-sidebar-row:opacity-100'
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute right-full top-0 h-full w-8 bg-gradient-to-l from-[var(--notes-sidebar-fade)] to-transparent',
                isActive && 'from-[var(--notes-sidebar-row-active)]',
                !isActive && 'group-hover/notes-sidebar-row:from-[var(--notes-sidebar-row-hover)]',
                actionFadeClassName
              )}
            />
            {actions}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
