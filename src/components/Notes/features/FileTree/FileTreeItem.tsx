import { memo } from 'react';
import { useDisplayName, useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { type FileTreeNode } from '@/stores/useNotesStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileTreeItemRenderer } from './components/FileTreeItemRenderer';
import { FileTreeItemMenu } from './components/FileTreeItemMenu';
import { useFileTreeItemState } from './hooks/useFileTreeItemState';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentNotePath?: string;
}

export const FileTreeItem = memo(function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  const {
    showMenu, setShowMenu,
    menuPosition,
    isRenaming, setIsRenaming,
    renameValue, setRenameValue,
    isDragOver,
    showDeleteDialog, setShowDeleteDialog,
    isItemStarred,
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers,
    actions
  } = useFileTreeItemState(node);

  const noteDisplayName = useDisplayName(node.isFolder ? undefined : node.path);
  const displayName = node.isFolder ? node.name : (noteDisplayName || node.name);
  const noteIcon = useDisplayIcon(node.isFolder ? undefined : node.path);
  const isActive = !node.isFolder && node.path === currentNotePath;

  return (
    <div className="relative">
      <FileTreeItemRenderer
        isFolder={node.isFolder}
        expanded={node.isFolder ? node.expanded : false}
        name={node.name}
        displayName={displayName}
        icon={noteIcon}
        isActive={isActive}
        isDragOver={isDragOver}
        isRenaming={isRenaming}
        depth={depth}
        renameValue={renameValue}
        onRenameChange={setRenameValue}
        onRenameSubmit={handleRenameSubmit}
        onRenameCancel={() => setIsRenaming(false)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMenuTrigger={handleMenuTrigger}
        dragHandlers={dragHandlers}
      />

      <FileTreeItemMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
        isFolder={node.isFolder}
        isStarred={isItemStarred}
        onRename={() => { setIsRenaming(true); setShowMenu(false); }}
        onNewNote={async () => { if (node.isFolder) await actions.createNote(node.path); setShowMenu(false); }}
        onOpenNewTab={() => { actions.openNote(node.path, true); setShowMenu(false); }}
        onToggleStar={() => {
            if (node.isFolder) actions.toggleFolderStarred(node.path);
            else actions.toggleStarred(node.path);
            setShowMenu(false);
        }}
        onDelete={() => { setShowMenu(false); setShowDeleteDialog(true); }}
      />

      {node.isFolder && node.expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentNotePath={currentNotePath}
            />
          ))}
        </div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[var(--neko-bg-primary)] border-[var(--neko-border)] max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-[var(--neko-text-primary)]">
              Delete {node.isFolder ? 'Folder' : 'Note'}
            </DialogTitle>
            <DialogDescription className="text-[var(--neko-text-secondary)]">
              Are you sure you want to delete "{node.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setShowDeleteDialog(false)}
              className={cn("px-4 py-2 text-sm rounded-md bg-[var(--neko-bg-secondary)] hover:bg-[var(--neko-hover)]")}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                  if (node.isFolder) await actions.deleteFolder(node.path);
                  else await actions.deleteNote(node.path);
                  setShowDeleteDialog(false);
              }}
              className="px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevNode = prevProps.node;
  const nextNode = nextProps.node;
  if (prevNode.id !== nextNode.id) return false;
  if (prevNode.name !== nextNode.name) return false;
  if (prevNode.isFolder !== nextNode.isFolder) return false;
  if (prevProps.depth !== nextProps.depth) return false;
  if (prevProps.currentNotePath !== nextProps.currentNotePath) return false;
  if (prevNode.isFolder && nextNode.isFolder) {
    if (prevNode.expanded !== nextNode.expanded) return false;
    if (prevNode.children?.length !== nextNode.children?.length) return false;
  }
  return true;
});
