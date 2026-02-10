import React, { useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles, NOTES_COLORS } from '@/lib/utils';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';

interface FileTreeItemRendererProps {
  isFolder: boolean;
  expanded: boolean;
  name: string;
  displayName: string;
  icon?: string | null;
  isActive: boolean;
  isDragOver: boolean;
  isRenaming: boolean;
  depth: number;
  renameValue: string;
  onRenameChange: (val: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuTrigger: (e: React.MouseEvent, rect: DOMRect) => void;
  dragHandlers: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export const FileTreeItemRenderer = ({
  isFolder, expanded, displayName, icon, isActive, isDragOver,
  isRenaming, depth, renameValue, onRenameChange, onRenameSubmit, onRenameCancel,
  onClick, onContextMenu, onMenuTrigger, dragHandlers
}: FileTreeItemRendererProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paddingLeft = 8 + depth * 16;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [isRenaming]);

  return (
    <div
      {...dragHandlers}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex items-center group py-[1px] cursor-pointer"
    >
      <div style={{ width: paddingLeft }} className="flex-shrink-0" />

      <div
        className={cn(
          "flex-1 flex items-center gap-2 pr-2 py-2 rounded-lg transition-all duration-200 ease-out mx-2",
          "hover:bg-[#F9F9FA] dark:hover:bg-[#1E1E1E]",
          isActive && "bg-[#f5f5f5] dark:bg-[#222]",
          isDragOver && "bg-[var(--neko-accent-light)] ring-1 ring-[var(--neko-accent)]"
        )}
      >
        {isFolder ? (
          <span className="w-[18px] h-[18px] flex items-center justify-center relative flex-shrink-0">
            <span className="group-hover:hidden">
              {expanded ? (
 <Icon size="md" name="file.folderOpen" className="text-amber-500" />
              ) : (
 <Icon size="md" name="file.folder" className="text-amber-500" />
              )}
            </span>
            <span className="hidden group-hover:block text-amber-500">
              {expanded ? (
 <Icon size="md" name="nav.chevronDown" />
              ) : (
 <Icon size="md" name="nav.chevronRight" />
              )}
            </span>
          </span>
        ) : (
          <span className="w-[20px] h-[20px] flex items-center justify-center flex-shrink-0">
            {icon ? (
              <NoteIcon icon={icon} size="md" />
            ) : (
 <Icon size="md" name="file.text" className="text-amber-500" />
            )}
          </span>
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            className={cn(
              "flex-1 min-w-0 text-sm px-1.5 py-0.5 rounded",
              "bg-[var(--neko-bg-primary)] border border-[var(--neko-accent)]",
              "text-[var(--neko-text-primary)] outline-none"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn(
            "flex-1 min-w-0 text-sm truncate text-[var(--neko-text-primary)]",
            isActive && "font-medium"
          )}>
            {displayName}
          </span>
        )}

        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              onMenuTrigger(e, rect);
            }
          }}
          className={cn(
            "p-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
            iconButtonStyles
          )}
        >
 <Icon size="md" name="common.more" />
        </button>
      </div>
    </div>
  );
};
