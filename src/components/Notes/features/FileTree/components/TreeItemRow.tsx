import React, { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';

export interface TreeItemDragHandlers {
  draggable: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
}

interface TreeItemRowProps {
  label: string;
  depth: number;
  leading: React.ReactNode;
  isActive?: boolean;
  isDragOver?: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onClick: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onMenuTrigger: (event: React.MouseEvent, rect: DOMRect) => void;
  dragHandlers: TreeItemDragHandlers;
}

export function TreeItemRow({
  label,
  depth,
  leading,
  isActive = false,
  isDragOver = false,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onClick,
  onContextMenu,
  onMenuTrigger,
  dragHandlers,
}: TreeItemRowProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paddingLeft = 8 + depth * 16;

  useEffect(() => {
    if (!isRenaming || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [isRenaming]);

  return (
    <div
      draggable={dragHandlers.draggable}
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group flex cursor-pointer items-center py-[1px]"
    >
      <div style={{ width: paddingLeft }} className="shrink-0" />

      <div
        className={cn(
          'mx-2 flex flex-1 items-center gap-2 rounded-lg py-2 pr-2 transition-all duration-200 ease-out',
          'hover:bg-[#F9F9FA] dark:hover:bg-[#1E1E1E]',
          isActive && 'bg-[#f5f5f5] dark:bg-[#222]',
          isDragOver && 'bg-[var(--neko-accent-light)] ring-1 ring-[var(--neko-accent)]'
        )}
      >
        <span className="flex size-[20px] shrink-0 items-center justify-center">
          {leading}
        </span>

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(event) => onRenameChange(event.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRenameSubmit();
              if (event.key === 'Escape') onRenameCancel();
            }}
            className={cn(
              'min-w-0 flex-1 rounded border border-[var(--neko-accent)] bg-[var(--neko-bg-primary)] px-1.5 py-0.5 text-sm text-[var(--neko-text-primary)] outline-none'
            )}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm text-[var(--neko-text-primary)]',
              isActive && 'font-medium'
            )}
          >
            {label}
          </span>
        )}

        <button
          ref={buttonRef}
          type="button"
          aria-label="Open item menu"
          onClick={(event) => {
            event.stopPropagation();
            if (!buttonRef.current) return;
            onMenuTrigger(event, buttonRef.current.getBoundingClientRect());
          }}
          className={cn(
            'shrink-0 p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
            iconButtonStyles
          )}
        >
          <Icon name="common.more" size="md" />
        </button>
      </div>
    </div>
  );
}
