import { memo, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { FolderNode } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { FolderItemMenu } from './components/FolderItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFolderItemState } from './hooks/useFolderItemState';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  currentNotePath?: string;
}

export const FolderItem = memo(function FolderItem({
  node,
  depth,
  currentNotePath,
}: FolderItemProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    isDragOver,
    showDeleteDialog,
    setShowDeleteDialog,
    isItemStarred,
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers,
    createNote,
    deleteFolder,
    toggleFolderStarred,
  } = useFolderItemState(node);
  const hasChildren = node.children.length > 0;

  const leading = node.expanded ? (
    <Icon name="file.folderOpen" size={NOTES_SIDEBAR_ICON_SIZE} className="text-[var(--notes-sidebar-folder-icon)]" />
  ) : (
    <Icon name="file.folder" size={NOTES_SIDEBAR_ICON_SIZE} className="text-[var(--notes-sidebar-folder-icon)]" />
  );

  return (
    <div className="relative" data-file-tree-path={node.path} data-file-tree-kind="folder">
      <NotesSidebarRow
        depth={depth}
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            <span
              className={cn(
                'transition-opacity duration-150',
                hasChildren && 'group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0',
              )}
            >
              {leading}
            </span>
            {hasChildren ? (
              <CollapseTriangleAffordance
                collapsed={!node.expanded}
                visibility="always"
                size={14}
                className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
                iconClassName="text-[var(--notes-sidebar-file-icon)]"
              />
            ) : null}
          </span>
        }
        isHighlighted={showMenu}
        isDragOver={isDragOver}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        dragHandlers={dragHandlers}
        showActionsByDefault={showMenu}
        main={
          isRenaming ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={handleRenameSubmit}
              onCancel={() => setIsRenaming(false)}
              className={cn(
                'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
                showMenu
                  ? 'text-[var(--notes-sidebar-text)]'
                  : 'text-[var(--notes-sidebar-text-muted)]'
              )}
            />
          ) : (
            <span className="block truncate text-[var(--notes-sidebar-text)]">{node.name}</span>
          )
        }
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open folder menu"
            onClick={(event) => {
              event.stopPropagation();
              if (!menuButtonRef.current) return;
              handleMenuTrigger(event, menuButtonRef.current.getBoundingClientRect());
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              showMenu
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
        }
      />

      <FolderItemMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
        isStarred={isItemStarred}
        onRename={() => {
          setIsRenaming(true);
          setShowMenu(false);
        }}
        onNewNote={() => {
          void createNote(node.path);
          setShowMenu(false);
        }}
        onToggleStar={() => {
          toggleFolderStarred(node.path);
          setShowMenu(false);
        }}
        onDelete={() => {
          setShowMenu(false);
          setShowDeleteDialog(true);
        }}
      />

      {node.expanded && node.children.length > 0 ? (
        <div>
          {node.children.map((child) =>
            child.isFolder ? (
              <FolderItem
                key={child.id}
                node={child}
                depth={depth + 1}
                currentNotePath={currentNotePath}
              />
            ) : (
              <FileItem
                key={child.id}
                node={child}
                depth={depth + 1}
                currentNotePath={currentNotePath}
              />
            )
          )}
        </div>
      ) : null}

      <TreeItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemLabel={node.name}
        itemType="Folder"
        onConfirm={() => deleteFolder(node.path)}
      />
    </div>
  );
}, areFolderItemPropsEqual);

function areFolderItemPropsEqual(prevProps: FolderItemProps, nextProps: FolderItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.node.expanded === nextProps.node.expanded &&
    prevProps.node.children === nextProps.node.children &&
    prevProps.depth === nextProps.depth &&
    prevProps.currentNotePath === nextProps.currentNotePath
  );
}
