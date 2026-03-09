import { memo } from 'react';
import { Icon } from '@/components/ui/icons';
import type { FolderNode } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { FolderItemMenu } from './components/FolderItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { TreeItemRow } from './components/TreeItemRow';
import { useFolderItemState } from './hooks/useFolderItemState';

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
    <Icon name="file.folderOpen" size="md" className="text-amber-500 group-hover:hidden" />
  ) : (
    <Icon name="file.folder" size="md" className="text-amber-500 group-hover:hidden" />
  );

  const hoverLeading = node.expanded ? (
    <Icon name="nav.chevronDown" size="md" className="hidden text-amber-500 group-hover:block" />
  ) : (
    <Icon name="nav.chevronRight" size="md" className="hidden text-amber-500 group-hover:block" />
  );

  return (
    <div className="relative" data-file-tree-path={node.path} data-file-tree-kind="folder">
      <TreeItemRow
        label={node.name}
        depth={depth}
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            {leading}
            {hoverLeading}
          </span>
        }
        isDragOver={isDragOver}
        isRenaming={isRenaming}
        renameValue={renameValue}
        onRenameChange={setRenameValue}
        onRenameSubmit={() => void handleRenameSubmit()}
        onRenameCancel={() => setIsRenaming(false)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMenuTrigger={handleMenuTrigger}
        dragHandlers={dragHandlers}
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
