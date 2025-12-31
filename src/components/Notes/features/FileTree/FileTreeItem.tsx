/**
 * FileTreeItem - Individual file or folder item in the tree
 */

import { useState, useRef } from 'react';
import { FileTextIcon, FolderIcon, FolderOpenIcon, CaretRightIcon, DotsThreeIcon, TrashIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentNotePath?: string;
}

export function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  const { openNote, toggleFolder, deleteNote, deleteFolder, renameNote, createNote, createFolder, moveItem } = useNotesStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const isActive = !node.isFolder && node.path === currentNotePath;
  const paddingLeft = 8 + depth * 16;

  const handleClick = () => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      openNote(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleDelete = async () => {
    const confirmed = confirm(`Delete "${node.name}"?`);
    if (confirmed) {
      if (node.isFolder) {
        await deleteFolder(node.path);
      } else {
        await deleteNote(node.path);
      }
    }
    setShowMenu(false);
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

  // Drag and drop handlers
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
        ref={dragRef}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft }}
        className={cn(
          "flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer group",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800",
          isActive && "bg-zinc-200 dark:bg-zinc-700",
          isDragOver && "bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-400"
        )}
      >
        {/* Folder caret or spacer */}
        {node.isFolder ? (
          <CaretRightIcon 
            className={cn(
              "size-3 text-zinc-400 transition-transform",
              node.expanded && "rotate-90"
            )} 
            weight="bold"
          />
        ) : (
          <span className="w-3" />
        )}

        {/* Icon */}
        {node.isFolder ? (
          node.expanded ? (
            <FolderOpenIcon className="size-4 text-amber-500" weight="duotone" />
          ) : (
            <FolderIcon className="size-4 text-amber-500" weight="duotone" />
          )
        ) : (
          <FileTextIcon className="size-4 text-zinc-400 dark:text-zinc-500" weight="duotone" />
        )}

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
            className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn(
            "flex-1 text-xs truncate",
            isActive 
              ? "text-zinc-900 dark:text-zinc-100 font-medium" 
              : "text-zinc-600 dark:text-zinc-400"
          )}>
            {node.name}
          </span>
        )}

        {/* Menu button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"
        >
          <DotsThreeIcon className="size-4 text-zinc-400" weight="bold" />
        </button>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-32">
            {node.isFolder && (
              <>
                <button
                  onClick={handleNewNoteInFolder}
                  className="w-full px-3 py-1.5 text-left text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <FileTextIcon className="size-3.5" weight="duotone" />
                  New Note
                </button>
                <button
                  onClick={handleNewFolderInFolder}
                  className="w-full px-3 py-1.5 text-left text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <FolderIcon className="size-3.5" weight="duotone" />
                  New Folder
                </button>
                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
              </>
            )}
            <button
              onClick={handleRename}
              className="w-full px-3 py-1.5 text-left text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
            >
              <PencilSimpleIcon className="size-3.5" weight="duotone" />
              Rename
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <TrashIcon className="size-3.5" weight="duotone" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Children (for folders) */}
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
    </div>
  );
}
