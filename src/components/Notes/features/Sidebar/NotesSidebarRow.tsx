import type { HTMLAttributes, ReactNode } from 'react';
import { SidebarRow } from '@/components/layout/sidebar/SidebarRow';
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
  return (
    <SidebarRow
      indentWidth={depth * 16}
      leading={leading}
      leadingClassName={leadingClassName}
      main={main}
      trailing={trailing}
      actions={actions}
      isActive={isActive}
      isDragOver={isDragOver}
      showActionsByDefault={showActionsByDefault}
      className={className}
      contentClassName={contentClassName}
      actionFadeClassName={cn(
        'from-[var(--notes-sidebar-fade)]',
        isActive && 'from-[var(--notes-sidebar-row-active)]',
        !isActive && 'group-hover/sidebar-row:from-[var(--notes-sidebar-row-hover)]',
        actionFadeClassName,
      )}
      activeClassName="bg-[var(--notes-sidebar-row-active)] text-[var(--notes-sidebar-text)]"
      inactiveClassName="text-[var(--notes-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)]"
      dragOverClassName="bg-[var(--notes-sidebar-row-drag)] ring-1 ring-[var(--vlaina-accent)]"
      draggable={dragHandlers?.draggable}
      onDragStart={dragHandlers?.onDragStart}
      onDragOver={dragHandlers?.onDragOver}
      onDragLeave={dragHandlers?.onDragLeave}
      onDrop={dragHandlers?.onDrop}
      {...props}
    >
      {children}
    </SidebarRow>
  );
}
