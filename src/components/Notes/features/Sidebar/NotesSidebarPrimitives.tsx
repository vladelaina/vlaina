import { Fragment, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import {
  SidebarList,
  SidebarScrollArea,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { themeIconTokens } from '@/styles/themeTokens';

interface NotesSidebarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  isPeeking?: boolean;
}

interface NotesSidebarScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  scrollbarInsetRight?: number;
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
        'group/notes-sidebar-surface flex h-full flex-col bg-[var(--vlaina-sidebar-notes-surface)] text-[var(--vlaina-sidebar-notes-text)]',
        className
      )}
      isPeeking={isPeeking}
      {...props}
    />
  );
}

export const NotesSidebarScrollArea = forwardRef<HTMLDivElement, NotesSidebarScrollAreaProps>(function NotesSidebarScrollArea({
  onMouseEnter,
  className,
  scrollbarInsetRight,
  ...props
}, ref) {
  return (
    <SidebarScrollArea
      ref={ref}
      onMouseEnter={onMouseEnter}
      scrollbarInsetRight={scrollbarInsetRight}
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
                'min-w-0 truncate font-semibold text-[var(--vlaina-sidebar-notes-section-label)] group-hover:text-[var(--vlaina-sidebar-notes-section-label-hover)]',
                nested ? 'text-[var(--vlaina-font-base)] tracking-[var(--vlaina-tracking-label-md)]' : 'text-[var(--vlaina-font-base)] tracking-[var(--vlaina-tracking-label-sm)]'
              )}>
                {title}
              </span>
              {isInteractive ? (
                <CollapseTriangleAffordance
                  collapsed={!expanded}
                  visibility="hover-unless-collapsed"
                  size={themeIconTokens.sizeXs}
                  className="h-[var(--vlaina-size-18px)] w-[var(--vlaina-size-18px)] shrink-0 text-[var(--vlaina-sidebar-notes-icon)] group-hover:text-[var(--vlaina-sidebar-notes-icon-hover)] group-focus-within:text-[var(--vlaina-sidebar-notes-icon-hover)]"
                />
              ) : null}
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {actions ? (
              <div className="flex items-center gap-1 opacity-[var(--vlaina-opacity-0)] pointer-events-none transition-opacity group-hover:opacity-[var(--vlaina-opacity-100)] group-hover:pointer-events-auto group-focus-within:opacity-[var(--vlaina-opacity-100)] group-focus-within:pointer-events-auto">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid',
          animated && 'transition-[grid-template-rows] duration-[var(--vlaina-duration-200)] ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className={cn(expanded ? 'overflow-visible' : 'overflow-hidden')}>
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
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--vlaina-sidebar-notes-empty-surface)] text-[var(--vlaina-sidebar-notes-icon)]">
          {icon}
        </div>
      ) : null}
      <span className="text-[var(--vlaina-font-base)] text-[var(--vlaina-sidebar-notes-text-muted)]">{title}</span>
      {description ? (
        <span className="text-[var(--vlaina-font-base)] text-[var(--vlaina-sidebar-notes-text-soft)]">{description}</span>
      ) : null}
    </div>
  );
}

interface NotesSidebarHoverEmptyHintProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
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
        'pointer-events-none flex items-center justify-center transition-opacity duration-[var(--vlaina-duration-150)]',
        placement === 'overlay'
          ? 'absolute left-1/2 top-[var(--vlaina-notes-empty-overlay-top)] z-[var(--vlaina-z-10)] -translate-x-1/2 -translate-y-1/2'
          : 'relative left-auto top-auto z-[var(--vlaina-z-0)] translate-x-0 translate-y-0',
        visible ? 'opacity-[var(--vlaina-opacity-100)]' : 'opacity-[var(--vlaina-opacity-0)] group-hover/notes-sidebar-surface:opacity-[var(--vlaina-opacity-100)]',
        className,
      )}
      {...props}
    >
      <div className="flex w-fit max-w-full flex-col items-center gap-2 text-center">
        {title ? (
          <span className="text-[var(--vlaina-font-15)] font-medium text-[var(--vlaina-sidebar-notes-text)]">
            {title}
          </span>
        ) : null}
        {actionItems.length > 0 ? (
          <div className={cn('flex max-w-full items-center justify-center gap-1 rounded-full px-1.5 py-1', chatComposerPillSurfaceClass)}>
            {actions && actionLabel && actionLabel !== title ? (
              <span className="px-2 text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text)]">
                {actionLabel}
              </span>
            ) : null}
            {actionItems.map((action, index) => (
              <Fragment key={action.label}>
                {index > 0 ? (
                  <span className="px-0.5 text-[var(--vlaina-font-sm)] text-[var(--vlaina-sidebar-notes-text-soft)]">/</span>
                ) : null}
                <button
                  type="button"
                  className="pointer-events-auto h-7 flex-none cursor-pointer whitespace-nowrap rounded-full px-3 text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-[var(--vlaina-sidebar-notes-row-hover)] hover:text-[var(--vlaina-sidebar-notes-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)]"
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

interface NotesSidebarPillEmptyHintProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: Array<{
    label: string;
    onAction: () => void;
  }>;
}

export function NotesSidebarPillEmptyHint({
  title,
  actions,
  className,
  ...props
}: NotesSidebarPillEmptyHintProps) {
  return (
    <div
      className={cn(
        'pointer-events-none flex items-center justify-center',
        className,
      )}
      {...props}
    >
      <div className="flex max-w-full flex-col items-center gap-2 text-center">
        {title ? (
          <span
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-center text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text-soft)]',
              chatComposerPillSurfaceClass,
            )}
          >
            {title}
          </span>
        ) : null}
        {actions?.length ? (
          <div className={cn('flex max-w-full items-center justify-center gap-1 rounded-full px-1.5 py-1', chatComposerPillSurfaceClass)}>
            {actions.map((action, index) => (
              <Fragment key={action.label}>
                {index > 0 ? (
                  <span className="px-0.5 text-[var(--vlaina-font-sm)] text-[var(--vlaina-sidebar-notes-text-soft)]">/</span>
                ) : null}
                <button
                  type="button"
                  className="pointer-events-auto h-7 flex-none cursor-pointer whitespace-nowrap rounded-full px-3 text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-[var(--vlaina-sidebar-notes-row-hover)] hover:text-[var(--vlaina-sidebar-notes-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)]"
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
