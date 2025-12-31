/**
 * FileTree - File tree navigation component
 * 
 * Modern style file browser
 */

import { type FolderNode } from '@/stores/useNotesStore';
import { FileTreeItem } from './FileTreeItem';

interface FileTreeProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string;
}

export function FileTree({ rootFolder, isLoading, currentNotePath }: FileTreeProps) {
  if (isLoading) {
    return (
      <div className="px-2 py-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 px-2">
              <div className="w-4 h-4 rounded bg-[var(--neko-bg-tertiary)] animate-pulse" />
              <div className="flex-1 h-4 rounded bg-[var(--neko-bg-tertiary)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rootFolder || rootFolder.children.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-[12px] text-[var(--neko-text-tertiary)]">
          No notes yet
        </p>
        <p className="text-[11px] text-[var(--neko-text-disabled)] mt-1">
          Click + to create one
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootFolder.children.map((node) => (
        <FileTreeItem 
          key={node.id} 
          node={node} 
          depth={0}
          currentNotePath={currentNotePath}
        />
      ))}
    </div>
  );
}
