import { useState, useCallback, useEffect } from 'react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';

export function useFileTreeItemState(node: FileTreeNode) {
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

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isItemStarred = node.isFolder ? isFolderStarred(node.path) : isStarred(node.path);

  // Sync renameValue
  useEffect(() => {
    if (!isRenaming) setRenameValue(node.name);
  }, [node.name, isRenaming]);

  // Auto rename
  useEffect(() => {
    if (node.isFolder && node.path === newlyCreatedFolderPath) {
      setIsRenaming(true);
      setRenameValue(node.name);
      clearNewlyCreatedFolder();
    }
  }, [node.isFolder, node.path, node.name, newlyCreatedFolderPath, clearNewlyCreatedFolder]);

  // Handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      openNote(node.path, e.ctrlKey || e.metaKey);
    }
  }, [node, toggleFolder, openNote]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ top: e.clientY, left: e.clientX });
    setShowMenu(true);
  }, []);

  const handleMenuTrigger = useCallback((_e: React.MouseEvent, rect: DOMRect) => {
    setMenuPosition({ top: rect.top, left: rect.right + 4 });
    setShowMenu(prev => !prev);
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!node.isFolder) return;
    
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath && sourcePath !== node.path && !sourcePath.startsWith(node.path + '/')) {
      await moveItem(sourcePath, node.path);
    }
  }, [node.isFolder, node.path, moveItem]);

  return {
    showMenu, setShowMenu,
    menuPosition,
    isRenaming, setIsRenaming,
    renameValue, setRenameValue,
    isDragOver, setIsDragOver,
    showDeleteDialog, setShowDeleteDialog,
    isItemStarred,
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    handleDragStart,
    handleDragOver,
    handleDrop,
    dragHandlers: {
      draggable: !isRenaming,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragLeave: () => setIsDragOver(false),
      onDrop: handleDrop
    },
    actions: {
        deleteNote, deleteFolder, createNote, 
        toggleStarred, toggleFolderStarred, openNote
    }
  };
}
