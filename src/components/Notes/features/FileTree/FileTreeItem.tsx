/**
 * FileTreeItem - Individual file or folder item
 * 
 * Modern style tree item with hover states
 */

import { useState, useRef } from 'react';
import { 
  IconChevronRight, 
  IconDots, 
  IconTrash, 
  IconPencil,
  IconFileText,
  IconFolder,
} from '@tabler/icons-react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
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

export function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  const { 
    openNote, 
    toggleFolder, 
    deleteNote, 
    deleteFolder, 
    renameNote, 
    createNote, 
    createFolder, 
    moveItem 
  } = useNotesStore();
  
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = !node.isFolder && node.path === currentNotePath;
  const paddingLeft = 8 + depth * 16;

  const handleClick = (e: React.MouseEvent) => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      // Ctrl+点击在新标签中打开，普通点击替换当前标签
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

  // Drag and drop
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
        style={{ paddingLeft }}
        className={cn(
          "group flex items-center gap-1 h-[30px] pr-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-[var(--neko-hover)]",
          isActive && "bg-[var(--neko-accent-light)] text-[var(--neko-accent)]",
          isDragOver && "bg-[var(--neko-accent-light)] ring-1 ring-[var(--neko-accent)]"
        )}
      >
        {/* Expand/Collapse Icon */}
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

        {/* Icon */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {node.isFolder ? (
            <IconFolder 
              className={cn(
                "w-4 h-4",
                isActive ? "text-[var(--neko-accent)]" : "text-amber-500"
              )} 
            />
          ) : (
            <IconFileText 
              className={cn(
                "w-4 h-4",
                isActive ? "text-[var(--neko-accent)]" : "text-[var(--neko-icon-secondary)]"
              )} 
            />
          )}
        </span>

        {/* Name */}
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
            "flex-1 min-w-0 text-[13px] truncate",
            isActive 
              ? "text-[var(--neko-accent)] font-medium" 
              : "text-[var(--neko-text-primary)]"
          )}>
            {node.name.replace('.md', '')}
          </span>
        )}

        {/* Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={cn(
            "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-[var(--neko-bg-active)] text-[var(--neko-icon-secondary)]"
          )}
        >
          <IconDots className="w-4 h-4" />
        </button>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div 
            ref={menuRef}
            className={cn(
              "absolute right-1 top-full z-50 min-w-[160px] py-1.5 rounded-lg shadow-lg",
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
        </>
      )}

      {/* Children */}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent 
          showCloseButton={false}
          className="bg-[var(--neko-bg-primary)] border-[var(--neko-border)] max-w-[320px]"
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--neko-text-primary)]">
              删除{node.isFolder ? '文件夹' : '笔记'}
            </DialogTitle>
            <DialogDescription className="text-[var(--neko-text-secondary)]">
              确定要删除 "{node.name}" 吗？{node.isFolder ? '文件夹内的所有内容都将被删除。' : ''}此操作无法撤销。
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
              取消
            </button>
            <button
              onClick={handleDeleteConfirm}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                "bg-red-500 text-white hover:bg-red-600"
              )}
            >
              删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Menu Item Component */
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
