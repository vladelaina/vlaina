import type { HTMLAttributes, ReactNode } from 'react';
import { SidebarRow } from '@/components/layout/sidebar/SidebarRow';
import { cn } from '@/lib/utils';

export interface NotesSidebarRowDragHandlers {
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}

interface NotesSidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  depth?: number;
  leading?: ReactNode;
  leadingClassName?: string;
  main: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  isHighlighted?: boolean;
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
  isHighlighted = false,
  isDragOver = false,
  showActionsByDefault = false,
  className,
  contentClassName,
  actionFadeClassName,
  dragHandlers,
  children,
  ...props
}: NotesSidebarRowProps) {
  return (
    <SidebarRow
      indentWidth={depth * 16}
      leading={leading}
      leadingClassName={leadingClassName}
      main={main}
      trailing={trailing}
      actions={actions}
      isActive={isActive}
      isHighlighted={isHighlighted}
      isDragOver={isDragOver}
      showActionsByDefault={showActionsByDefault}
      className={cn(className, dragHandlers?.isDragging && 'opacity-60')}
      contentClassName={contentClassName}
      actionFadeClassName={cn(
        'from-[var(--notes-sidebar-fade)]',
        isHighlighted && 'from-[var(--notes-sidebar-row-hover)]',
        isActive && !isHighlighted && 'from-[var(--notes-sidebar-row-active)]',
        !isActive && !isHighlighted && 'group-hover/sidebar-row:from-[var(--notes-sidebar-row-hover)]',
        actionFadeClassName,
      )}
      activeClassName="bg-[var(--notes-sidebar-row-active)] text-[var(--notes-sidebar-text)]"
      highlightClassName="bg-[var(--notes-sidebar-row-hover)] text-[var(--notes-sidebar-text)]"
      inactiveClassName="text-[var(--notes-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)]"
      dragOverClassName="bg-[var(--notes-sidebar-row-drag)] ring-1 ring-[var(--vlaina-accent)]"
      onPointerDown={dragHandlers?.onPointerDown}
      {...props}
    >
      {children}
    </SidebarRow>
  );
}
