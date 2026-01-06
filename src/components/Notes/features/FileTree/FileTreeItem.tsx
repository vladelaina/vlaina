// FileTreeItem - Individual file or folder item

import { useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { 
  IconChevronRight, 
  IconDots, 
  IconTrash, 
  IconPencil,
  IconFileText,
  IconFolder,
} from '@tabler/icons-react';
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

export const FileTreeItem = memo(function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  const openNote = useNotesStore(s => s.openNote);
  const toggleFolder = useNotesStore(s => s.toggleFolder);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const deleteFolder = useNotesStore(s => s.deleteFolder);
  const renameNote = useNotesStore(s => s.renameNote);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);
  const moveItem = useNotesStore(s => s.moveItem);
  
  const displayName = useDisplayName(node.isFolder ? undefined : node.path) || node.name;
  const noteIcon = useDisplayIcon(node.isFolder ? undefined : node.path);
  
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isActive = !node.isFolder && node.path === currentNotePath;
  const paddingLeft = 8 + depth * 16;

  const handleClick = (e: React.MouseEvent) => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      openNote(node.path, e.ctrlKey || e.metaKey);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (node.isFolder) {
      await deleteFolder(node.path);
    } else {
      await deleteNote(node.path);
    }
    setShowDeleteDialog(false);
  };

  const handleRename = () => {
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleRenameSubmit = async () => {
    if (renameValue.trim() && renameValue !== node.name) {
      await renameNote(node.path, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleNewNoteInFolder = async () => {
    if (node.isFolder) {
      await createNote(node.path);
    }
    setShowMenu(false);
  };

  const handleNewFolderInFolder = async () => {
    if (node.isFolder) {
      const name = prompt('Folder name:');
      if (name?.trim()) {
        await createFolder(node.path, name.trim());
      }
    }
    setShowMenu(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.isFolder) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (!node.isFolder) return;
    
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath && sourcePath !== node.path && !sourcePath.startsWith(node.path + '/')) {
      await moveItem(sourcePath, node.path);
    }
  };

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
        className="flex items-center h-[30px] cursor-pointer"
      >
        {/* Indent spacer - no background */}
        <div style={{ width: paddingLeft }} className="flex-shrink-0" />
        
        {/* Content with background */}
        <div
          className={cn(
            "group flex-1 flex items-center gap-1 h-full pr-2 rounded-md transition-colors",
            "hover:bg-[var(--neko-hover)]",
            isDragOver && "bg-[var(--neko-accent-light)] ring-1 ring-[var(--neko-accent)]"
          )}
          style={isActive ? { backgroundColor: NOTES_COLORS.activeItem } : undefined}
        >
        {node.isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center">
            <IconChevronRight 
              className={cn(
                "w-3 h-3 text-[var(--neko-icon-secondary)] transition-transform duration-150",
                node.expanded && "rotate-90"
              )} 
            />
          </span>
        ) : (
          <span className="w-4" />
        )}

        <span className="w-4 h-4 flex items-center justify-center">
          {node.isFolder ? (
            <IconFolder className="w-4 h-4 text-amber-500" />
          ) : noteIcon ? (
            <NoteIcon icon={noteIcon} size={16} />
          ) : (
            <IconFileText className="w-4 h-4 text-[var(--neko-icon-secondary)]" />
          )}
        </span>

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
              setMenuPosition({
                top: rect.bottom + 4,
                left: rect.right - 160,
              });
            }
            setShowMenu(!showMenu);
          }}
          className={cn(
            "p-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            iconButtonStyles
          )}
        >
          <IconDots className="w-4 h-4" />
        </button>
        </div>
      </div>

      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowMenu(false)}
          />
          <div 
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className={cn(
              "fixed z-[9999] min-w-[160px] py-1.5 rounded-lg shadow-lg",
              "bg-[var(--neko-bg-primary)] border border-[var(--neko-border)]"
            )}
          >
            {node.isFolder && (
              <>
                <MenuItem 
                  icon={<IconFileText />} 
                  label="New Note" 
                  onClick={handleNewNoteInFolder} 
                />
                <MenuItem 
                  icon={<IconFolder />} 
                  label="New Folder" 
                  onClick={handleNewFolderInFolder} 
                />
                <div className="h-px bg-[var(--neko-divider)] my-1.5 mx-2" />
              </>
            )}
            <MenuItem 
              icon={<IconPencil />} 
              label="Rename" 
              onClick={handleRename} 
            />
            <MenuItem 
              icon={<IconTrash />} 
              label="Delete" 
              onClick={handleDeleteClick}
              danger 
            />
          </div>
        </>,
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
});

function MenuItem({ 
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
        "w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors",
        danger 
          ? "text-red-500 hover:bg-red-500/10" 
          : "text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)]"
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      {label}
    </button>
  );
}
