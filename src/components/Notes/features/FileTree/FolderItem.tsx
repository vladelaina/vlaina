import { memo, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import type { FolderNode } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { FolderItemMenu } from './components/FolderItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFolderItemState } from './hooks/useFolderItemState';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';

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

  const leading = node.expanded ? (
    <Icon name="file.folderOpen" size="sidebar" className="text-[var(--notes-sidebar-folder-icon)]" />
  ) : (
    <Icon name="file.folder" size="sidebar" className="text-[var(--notes-sidebar-folder-icon)]" />
  );

  return (
    <div className="relative" data-file-tree-path={node.path} data-file-tree-kind="folder">
      <NotesSidebarRow
        depth={depth}
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            {leading}
          </span>
        }
        isDragOver={isDragOver}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        dragHandlers={dragHandlers}
        main={
          isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => void handleRenameSubmit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleRenameSubmit();
                if (event.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full min-w-0 rounded border border-[var(--neko-accent)] bg-transparent px-1.5 py-0.5 text-sm leading-5 text-[var(--notes-sidebar-text)] outline-none"
              onClick={(event) => event.stopPropagation()}
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
              'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
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
