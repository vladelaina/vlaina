// FileTreeItem - Individual file or folder item

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Ellipsis,
  Trash2,
  Pencil,
  FileText,
  Folder,
  FolderOpen,
  Star,
  Info,
  FilePlus2,
  Copy,
  ExternalLink,
  SplitSquareHorizontal,
} from 'lucide-react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { useDisplayName, useDisplayIcon } from '@/hooks/useTitleSync';
import { cn, iconButtonStyles, NOTES_COLORS } from '@/lib/utils';
import { NoteIcon } from '../IconPicker/NoteIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentNotePath?: string;
}

export const FileTreeItem = React.memo(function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  const openNote = useNotesStore(s => s.openNote);
  const toggleFolder = useNotesStore(s => s.toggleFolder);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const deleteFolder = useNotesStore(s => s.deleteFolder);
  const renameNote = useNotesStore(s => s.renameNote);
  const renameFolder = useNotesStore(s => s.renameFolder);
  const createNote = useNotesStore(s => s.createNote);

  const moveItem = useNotesStore(s => s.moveItem);
  const newlyCreatedFolderPath = useNotesStore(s => s.newlyCreatedFolderPath);
  const clearNewlyCreatedFolder = useNotesStore(s => s.clearNewlyCreatedFolder);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const toggleFolderStarred = useNotesStore(s => s.toggleFolderStarred);
  const isStarred = useNotesStore(s => s.isStarred);
  const isFolderStarred = useNotesStore(s => s.isFolderStarred);

  const isItemStarred = node.isFolder ? isFolderStarred(node.path) : isStarred(node.path);

  const noteDisplayName = useDisplayName(node.isFolder ? undefined : node.path);
  const displayName = node.isFolder ? node.name : (noteDisplayName || node.name);
  const noteIcon = useDisplayIcon(node.isFolder ? undefined : node.path);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync renameValue when node.name changes
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(node.name);
    }
  }, [node.name, isRenaming]);

  // Auto-enter rename mode for newly created folders
  useEffect(() => {
    if (node.isFolder && node.path === newlyCreatedFolderPath) {
      setIsRenaming(true);
      setRenameValue(node.name);
      clearNewlyCreatedFolder();
    }
  }, [node.isFolder, node.path, node.name, newlyCreatedFolderPath, clearNewlyCreatedFolder]);

  const isActive = !node.isFolder && node.path === currentNotePath;
  const paddingLeft = 8 + depth * 16;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      openNote(node.path, e.ctrlKey || e.metaKey);
    }
  }, [node.isFolder, node.path, toggleFolder, openNote]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setShowMenu(false);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (node.isFolder) {
      await deleteFolder(node.path);
    } else {
      await deleteNote(node.path);
    }
    setShowDeleteDialog(false);
  }, [node.isFolder, node.path, deleteFolder, deleteNote]);

  const handleRename = useCallback(() => {
    setIsRenaming(true);
    setShowMenu(false);
  }, []);

  const handleRenameSubmit = async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      if (node.isFolder) {
        await renameFolder(node.path, trimmedValue);
      } else {
        await renameNote(node.path, trimmedValue);
      }
    }
    setIsRenaming(false);
  };

  const handleNewNoteInFolder = useCallback(async () => {
    if (node.isFolder) {
      await createNote(node.path);
    }
    setShowMenu(false);
  }, [node.isFolder, node.path, createNote]);

  /* const handleNewFolderInFolder = async () => {
    if (node.isFolder) {
      await createFolder(node.path);
    }
    setShowMenu(false);
  }; */

  const handleToggleStar = useCallback(() => {
    if (node.isFolder) {
      toggleFolderStarred(node.path);
    } else {
      toggleStarred(node.path);
    }
    setShowMenu(false);
  }, [node.isFolder, node.path, toggleFolderStarred, toggleStarred]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  }, [node.path]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (node.isFolder) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  }, [node.isFolder]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!node.isFolder) return;

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath && sourcePath !== node.path && !sourcePath.startsWith(node.path + '/')) {
      await moveItem(sourcePath, node.path);
    }
  }, [node.isFolder, node.path, moveItem]);

  return (
    <div className="relative">
      <div
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center group py-[1px] cursor-pointer"
      >
        {/* Indent spacer - no background */}
        <div style={{ width: paddingLeft }} className="flex-shrink-0" />

        {/* Content with background */}
        <div
          className={cn(
            "flex-1 flex items-center gap-2 pr-2 py-1.5 rounded-[6px] transition-all duration-200 ease-out mx-2",
            "hover:bg-[var(--neko-bg-hover)]",
            isActive && "bg-[var(--neko-bg-active)]",
            isDragOver && "bg-[var(--neko-accent-light)] ring-1 ring-[var(--neko-accent)]"
          )}
          style={isActive ? { backgroundColor: NOTES_COLORS.activeItem } : undefined}
        >
          {node.isFolder ? (
            <span className="w-4 h-4 flex items-center justify-center relative">
              {/* Folder icon - hidden on hover */}
              <span className="group-hover:hidden">
                {node.expanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-500" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500" />
                )}
              </span>
              {/* Chevron icon - shown on hover */}
              <span className="hidden group-hover:block text-amber-500">
                {node.expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </span>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center">
              {noteIcon ? (
                <NoteIcon icon={noteIcon} size={16} />
              ) : (
                <FileText className="w-4 h-4 text-amber-500" />
              )}
            </span>
          )}

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              className={cn(
                "flex-1 min-w-0 text-[13px] px-1.5 py-0.5 rounded",
                "bg-[var(--neko-bg-primary)] border border-[var(--neko-accent)]",
                "text-[var(--neko-text-primary)] outline-none"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn(
              "flex-1 min-w-0 text-[13px] truncate text-[var(--neko-text-primary)]",
              isActive && "font-medium"
            )}>
              {displayName}
            </span>
          )}

          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!showMenu && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();

                // Position: To the right of the button, align top with button top
                setMenuPosition({
                  top: rect.top, // Align top
                  left: rect.right + 4, // Shift right slightly
                });
                setMenuPlacement('bottom'); // Always animate top-down
              }
              setShowMenu(!showMenu);
            }}
            className={cn(
              "p-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              iconButtonStyles
            )}
          >
            <Ellipsis className="w-4 h-4" />
          </button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                className="fixed inset-0 z-[9998]"
                onClick={() => setShowMenu(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              />
              <motion.div
                ref={menuRef}
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left,
                  transformOrigin: 'top left'
                }}
                className={cn(
                  "fixed z-[9999] min-w-[240px] p-2 rounded-lg",
                  "bg-[var(--neko-bg-primary)]",
                  "border border-[var(--neko-border)]",
                  "shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12),0_2px_6px_-1px_rgba(0,0,0,0.08)]"
                )}
                initial={{ opacity: 0, scale: 0.9, y: menuPlacement === 'bottom' ? -8 : 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  mass: 0.5
                }}
              >
                <MenuItem
                  icon={<Pencil />}
                  label="Rename"
                  onClick={handleRename}
                />
                <MenuItem
                  icon={<Info />}
                  label="View Info"
                  onClick={() => setShowMenu(false)}
                />
                {node.isFolder && (
                  <MenuItem
                    icon={<FilePlus2 />}
                    label="Add linked doc"
                    onClick={handleNewNoteInFolder}
                  />
                )}
                <MenuItem
                  icon={<Copy />}
                  label="Duplicate"
                  onClick={() => setShowMenu(false)}
                />
                <MenuItem
                  icon={<ExternalLink />}
                  label="Open in new tab"
                  onClick={() => {
                    openNote(node.path, true);
                    setShowMenu(false);
                  }}
                />
                <MenuItem
                  icon={<SplitSquareHorizontal />}
                  label="Open in split view"
                  onClick={() => setShowMenu(false)}
                />
                <MenuItem
                  icon={isItemStarred ? <Star className="text-amber-500 fill-amber-500" /> : <Star />}
                  label={isItemStarred ? "Remove from favourites" : "Add to favourites"}
                  onClick={handleToggleStar}
                />
                <div className="h-px bg-[var(--neko-border)] my-1 mx-1" />
                <MenuItem
                  icon={<Trash2 />}
                  label="Move to trash"
                  onClick={handleDeleteClick}
                  danger
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

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
        <DialogContent
          showCloseButton={false}
          className="bg-[var(--neko-bg-primary)] border-[var(--neko-border)] max-w-[320px]"
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--neko-text-primary)]">
              Delete {node.isFolder ? 'Folder' : 'Note'}
            </DialogTitle>
            <DialogDescription className="text-[var(--neko-text-secondary)]">
              Are you sure you want to delete "{node.name}"?{node.isFolder ? ' All contents in the folder will be deleted.' : ''} This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setShowDeleteDialog(false)}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                "bg-[var(--neko-bg-secondary)] text-[var(--neko-text-primary)]",
                "hover:bg-[var(--neko-hover)] border border-[var(--neko-border)]"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                "bg-red-500 text-white hover:bg-red-600"
              )}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo: only re-render if key props changed
  const prevNode = prevProps.node;
  const nextNode = nextProps.node;

  // Basic checks
  if (prevNode.id !== nextNode.id) return false;
  if (prevNode.name !== nextNode.name) return false;
  if (prevNode.isFolder !== nextNode.isFolder) return false;
  if (prevProps.depth !== nextProps.depth) return false;
  if (prevProps.currentNotePath !== nextProps.currentNotePath) return false;

  // Folder-specific checks
  if (prevNode.isFolder && nextNode.isFolder) {
    if (prevNode.expanded !== nextNode.expanded) return false;
    if (prevNode.children?.length !== nextNode.children?.length) return false;
  }

  return true;
});

const MenuItem = React.memo(function MenuItem({
  icon,
  label,
  onClick,
  danger = false
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded-[5px] text-[13px] font-[450] tracking-[-0.01em] transition-colors",
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-[var(--neko-text-primary)] hover:bg-[var(--neko-bg-hover)]"
      )}
    >
      <span className={cn(
        "w-[16px] h-[16px] flex items-center justify-center flex-shrink-0 [&>svg]:w-[14px] [&>svg]:h-[14px]",
        danger ? "text-red-500" : "text-[var(--neko-text-secondary)]"
      )}>
        {icon}
      </span>
      {label}
    </button>
  );
});
