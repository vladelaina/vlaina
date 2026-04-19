import { useRef, type ReactNode } from 'react';
import type React from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow, type NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';
import {
  clearHoveredSidebarRenamePath,
  setHoveredSidebarRenamePath,
} from '../../common/sidebarHoverRename';

interface TreeItemShellProps {
  itemPath: string;
  itemKind: 'file' | 'folder';
  parentFolderPath?: string;
  depth: number;
  leading: ReactNode;
  main: ReactNode;
  children?: ReactNode;
  actionFadeClassName?: string;
  contentClassName?: string;
  isActive?: boolean;
  isHighlighted?: boolean;
  isDragOver?: boolean;
  showActionsByDefault?: boolean;
  dragHandlers?: NotesSidebarRowDragHandlers;
  menuButtonLabel: string;
  isMenuButtonActive?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMenuClick: (event: React.MouseEvent<HTMLButtonElement>, rect: DOMRect) => void;
}

export function TreeItemShell({
  itemPath,
  itemKind,
  parentFolderPath,
  depth,
  leading,
  main,
  children,
  actionFadeClassName,
  contentClassName,
  isActive = false,
  isHighlighted = false,
  isDragOver = false,
  showActionsByDefault = false,
  dragHandlers,
  menuButtonLabel,
  isMenuButtonActive = false,
  onClick,
  onContextMenu,
  onMenuClick,
}: TreeItemShellProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="relative"
      data-file-tree-path={itemPath}
      data-file-tree-kind={itemKind}
      data-file-tree-parent-folder-path={parentFolderPath}
    >
      <NotesSidebarRow
        depth={depth}
        actionFadeClassName={actionFadeClassName}
        onMouseEnter={() => setHoveredSidebarRenamePath(itemPath)}
        onMouseLeave={() => clearHoveredSidebarRenamePath(itemPath)}
        leading={leading}
        main={main}
        contentClassName={contentClassName}
        isActive={isActive}
        isHighlighted={isHighlighted}
        isDragOver={isDragOver}
        onClick={onClick}
        onContextMenu={onContextMenu}
        dragHandlers={dragHandlers}
        showActionsByDefault={showActionsByDefault}
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuButtonLabel}
            onClick={(event) => {
              event.stopPropagation();
              const button = menuButtonRef.current;
              if (!button) {
                return;
              }

              onMenuClick(event, button.getBoundingClientRect());
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              isMenuButtonActive
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]',
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
        }
      />

      {children}
    </div>
  );
}
