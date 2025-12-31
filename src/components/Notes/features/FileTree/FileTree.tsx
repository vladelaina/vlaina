/**
 * FileTree - File tree navigation component
 * 
 * Displays the folder structure and allows navigation
 */

import { PlusIcon, FolderPlusIcon } from '@phosphor-icons/react';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { FileTreeItem } from '.';

interface FileTreeProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string;
}

export function FileTree({ rootFolder, isLoading, currentNotePath }: FileTreeProps) {
  const { createNote, createFolder } = useNotesStore();

  const handleNewNote = async () => {
    await createNote();
  };

  const handleNewFolder = async () => {
    const name = prompt('Folder name:');
    if (name?.trim()) {
      await createFolder('', name.trim());
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewNote}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="New Note"
          >
            <PlusIcon className="size-4 text-zinc-500 dark:text-zinc-400" weight="bold" />
          </button>
          <button
            onClick={handleNewFolder}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="New Folder"
          >
            <FolderPlusIcon className="size-4 text-zinc-500 dark:text-zinc-400" weight="bold" />
          </button>
        </div>
      </div>

      {/* File Tree Content */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="text-xs text-zinc-400 dark:text-zinc-600 p-2">
            Loading notes...
          </div>
        ) : rootFolder?.children.length === 0 ? (
          <div className="text-xs text-zinc-400 dark:text-zinc-600 p-2 text-center">
            No notes yet.
            <br />
            Click + to create one.
          </div>
        ) : (
          <div className="space-y-0.5">
            {rootFolder?.children.map((node) => (
              <FileTreeItem 
                key={node.id} 
                node={node} 
                depth={0}
                currentNotePath={currentNotePath}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
