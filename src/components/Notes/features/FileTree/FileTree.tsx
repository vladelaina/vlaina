import { type FolderNode } from '@/stores/useNotesStore';
import { NotesSidebarList } from '../Sidebar/NotesSidebarPrimitives';
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
              <div className="w-[18px] h-[18px] rounded bg-[var(--vlaina-bg-tertiary)] animate-pulse" />
              <div className="flex-1 h-[18px] rounded bg-[var(--vlaina-bg-tertiary)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rootFolder || rootFolder.children.length === 0) {
    return null;
  }

  return (
    <NotesSidebarList className="py-1">
      {rootFolder.children.map((node) => (
        <FileTreeItem 
          key={node.id} 
          node={node} 
          depth={0}
          currentNotePath={currentNotePath}
        />
      ))}
    </NotesSidebarList>
  );
}
