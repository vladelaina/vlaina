import { Fragment, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import {
  SidebarList,
  SidebarScrollArea,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';

interface NotesSidebarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  isPeeking?: boolean;
}

interface NotesSidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  expanded?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  contentClassName?: string;
  animated?: boolean;
  nested?: boolean;
  flushHeader?: boolean;
  headerClassName?: string;
}

export function NotesSidebarSurface({
  className,
  isPeeking = false,
  ...props
}: NotesSidebarSurfaceProps) {
  return (
    <SidebarSurface
      className={cn(
        'group/notes-sidebar-surface flex h-full flex-col bg-[var(--notes-sidebar-surface)] text-[var(--notes-sidebar-text)]',
        className
      )}
      isPeeking={isPeeking}
      {...props}
    />
  );
}

export const NotesSidebarScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function NotesSidebarScrollArea({
  onMouseEnter,
  className,
  ...props
}, ref) {
  return (
    <SidebarScrollArea
      ref={ref}
      onMouseEnter={onMouseEnter}
      viewportClassName={className}
      {...props}
    />
  );
});

export function NotesSidebarList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <SidebarList className={className} {...props} />;
}

export function NotesSidebarSection({
  title,
  expanded = true,
  onToggle,
  actions,
  children,
  className,
  contentClassName,
  animated = true,
  nested = false,
  flushHeader = false,
  headerClassName,
  ...props
}: NotesSidebarSectionProps) {
  const isInteractive = typeof onToggle === 'function';

  return (
    <div className={cn(nested ? 'mb-1' : 'mb-2', className)} {...props}>
      <div className={cn(
        nested ? 'px-0 pb-0.5' : 'px-1 pb-1'
      )}>
        <div
          onClick={(event) => {
            if (!isInteractive) return;
            const target = event.target as HTMLElement;
            if (target.closest('button')) return;
            onToggle();
          }}
          className={cn(
            'group flex items-center justify-between',
            nested
              ? 'min-h-7 rounded-md px-2'
              : flushHeader
                ? 'min-h-8 rounded-lg px-0'
                : 'min-h-8 rounded-lg px-2',
            headerClassName,
            isInteractive && 'cursor-pointer'
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full items-center gap-1 align-middle">
              <span className={cn(
                'min-w-0 truncate font-semibold text-[var(--notes-sidebar-section-label)] group-hover:text-[var(--notes-sidebar-section-label-hover)]',
                nested ? 'text-[16px] tracking-[0.1em]' : 'text-[16px] tracking-[0.08em]'
              )}>
                {title}
              </span>
              {isInteractive ? (
                <CollapseTriangleAffordance
                  collapsed={!expanded}
                  visibility="hover-unless-collapsed"
                  size={12}
                  className="h-[18px] w-[18px] shrink-0 text-[var(--notes-sidebar-icon)] group-hover:text-[var(--notes-sidebar-icon-hover)] group-focus-within:text-[var(--notes-sidebar-icon-hover)]"
                />
              ) : null}
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {actions ? (
              <div className="flex items-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid',
          animated && 'transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(nested ? 'px-0' : 'px-1', contentClassName)}>{children}</div>
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
      <span className="text-[16px] text-[var(--notes-sidebar-text-muted)]">{title}</span>
      {description ? (
        <span className="text-[16px] text-[var(--notes-sidebar-text-soft)]">{description}</span>
      ) : null}
    </div>
  );
}

interface NotesSidebarHoverEmptyHintProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actions?: Array<{
    label: string;
    onAction: () => void;
  }>;
  visible?: boolean;
  placement?: 'overlay' | 'inline';
}

export function NotesSidebarHoverEmptyHint({
  title,
  actionLabel,
  onAction,
  actions,
  visible = false,
  placement = 'overlay',
  className,
  ...props
}: NotesSidebarHoverEmptyHintProps) {
  const actionItems = actions ?? (
    actionLabel && onAction
      ? [{ label: actionLabel, onAction }]
      : []
  );

  return (
    <div
      className={cn(
        'pointer-events-none flex items-center justify-center transition-opacity duration-150',
        placement === 'overlay'
          ? 'absolute left-1/2 top-[38.2%] z-10 -translate-x-1/2 -translate-y-1/2'
          : 'relative left-auto top-auto z-0 translate-x-0 translate-y-0',
        visible ? 'opacity-100' : 'opacity-0 group-hover/notes-sidebar-surface:opacity-100',
        className,
      )}
      {...props}
    >
      <div className="flex max-w-[180px] flex-col items-center gap-1.5 px-4 text-center">
        <span className="text-[16px] text-[var(--notes-sidebar-text)]">
          {title}
        </span>
        {actionItems.length > 0 ? (
          <div className="flex items-center justify-center gap-1">
            {actions && actionLabel && actionLabel !== title ? (
              <span className="text-[16px] text-[var(--notes-sidebar-text)]">
                {actionLabel}
              </span>
            ) : null}
            {actionItems.map((action, index) => (
              <Fragment key={action.label}>
                {index > 0 ? (
                  <span className="text-[16px] text-[var(--notes-sidebar-text-soft)]">/</span>
                ) : null}
                <button
                  type="button"
                  className="pointer-events-auto h-7 cursor-pointer rounded-md px-3 text-[16px] text-[var(--notes-sidebar-text-soft)] hover:bg-[var(--notes-sidebar-row-hover)] hover:text-[var(--notes-sidebar-text)] focus:outline-none"
                  onClick={(event) => {
                    event.stopPropagation();
                    action.onAction();
                  }}
                >
                  {action.label}
                </button>
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
