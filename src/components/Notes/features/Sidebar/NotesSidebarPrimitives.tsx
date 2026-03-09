import type { HTMLAttributes, ReactNode } from 'react';
import { ToggleIcon } from '@/components/common/ToggleIcon';
import { cn } from '@/lib/utils';

interface NotesSidebarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  isPeeking?: boolean;
}

interface NotesSidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  expanded?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  contentClassName?: string;
}

export function NotesSidebarSurface({
  className,
  isPeeking = false,
  ...props
}: NotesSidebarSurfaceProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col bg-[var(--notes-sidebar-surface)] text-[var(--notes-sidebar-text)]',
        isPeeking && 'opacity-95',
        className
      )}
      {...props}
    />
  );
}

export function NotesSidebarScrollArea({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('neko-scrollbar flex-1 overflow-y-auto px-2 py-2', className)}
      {...props}
    />
  );
}

export function NotesSidebarList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

export function NotesSidebarSection({
  title,
  expanded = true,
  onToggle,
  actions,
  children,
  className,
  contentClassName,
  ...props
}: NotesSidebarSectionProps) {
  const isInteractive = typeof onToggle === 'function';

  return (
    <div className={cn('mb-2', className)} {...props}>
      <div className="px-1 pb-1">
        <div
          onClick={(event) => {
            if (!isInteractive) return;
            const target = event.target as HTMLElement;
            if (target.closest('button')) return;
            onToggle();
          }}
          className={cn(
            'group flex min-h-8 items-center justify-between rounded-lg px-2',
            isInteractive && 'cursor-pointer'
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {isInteractive ? (
              <ToggleIcon
                expanded={expanded}
                size="md"
                className="text-[var(--notes-sidebar-icon)] transition-colors group-hover:text-[var(--notes-sidebar-icon-hover)]"
              />
            ) : null}
            <span className="truncate text-[11px] font-semibold tracking-[0.08em] text-[var(--notes-sidebar-section-label)] transition-colors group-hover:text-[var(--notes-sidebar-section-label-hover)]">
              {title}
            </span>
          </div>
          {actions ? (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn('px-1', contentClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

interface NotesSidebarEmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function NotesSidebarEmptyState({
  icon,
  title,
  description,
  className,
  ...props
}: NotesSidebarEmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-2 px-3 py-6 text-center', className)}
      {...props}
    >
      {icon ? (
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--notes-sidebar-empty-surface)] text-[var(--notes-sidebar-icon)]">
          {icon}
        </div>
      ) : null}
      <span className="text-[13px] text-[var(--notes-sidebar-text-muted)]">{title}</span>
      {description ? (
        <span className="text-[11px] text-[var(--notes-sidebar-text-soft)]">{description}</span>
      ) : null}
    </div>
  );
}
