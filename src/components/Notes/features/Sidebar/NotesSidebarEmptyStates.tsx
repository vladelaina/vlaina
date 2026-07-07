import { Fragment, type HTMLAttributes, type ReactNode } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';

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
                  className="pointer-events-auto h-7 flex-none cursor-pointer whitespace-nowrap rounded-full px-3 text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)]"
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
                  className="pointer-events-auto h-7 flex-none cursor-pointer whitespace-nowrap rounded-full px-3 text-[var(--vlaina-font-15)] text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)]"
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
