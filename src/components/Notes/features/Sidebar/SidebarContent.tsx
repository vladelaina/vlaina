import { StarredSection } from '../Starred';
import { WorkspaceSection } from '../FileTree';
import { cn } from '@/lib/utils';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';

interface SidebarContentProps {
  rootFolder: any;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => void;
  createFolder: (path: string) => void;
  className?: string;
  isPeeking?: boolean;
}

export function SidebarContent({
  rootFolder,
  isLoading,
  currentNotePath,
  createNote,
  createFolder,
  className,
  isPeeking = false,
}: SidebarContentProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <NotesSidebarScrollArea
        className={cn(isPeeking ? 'neko-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
      >
        <StarredSection />
        <WorkspaceSection
          rootFolder={rootFolder}
          isLoading={isLoading}
          currentNotePath={currentNotePath ?? undefined}
          onCreateNote={createNote}
          onCreateFolder={() => createFolder('')}
        />
      </NotesSidebarScrollArea>
    </div>
  );
}
