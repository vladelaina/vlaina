import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { SidebarContent } from './SidebarContent';
import { NotesOutline } from './Outline';

interface NotesSidebarPanelProps {
  rootFolder: any;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => void;
  createFolder: (path: string) => void;
  isPeeking?: boolean;
}

export function NotesSidebarPanel({
  rootFolder,
  isLoading,
  currentNotePath,
  createNote,
  createFolder,
  isPeeking = false,
}: NotesSidebarPanelProps) {
  const sidebarView = useUIStore((s) => s.notesSidebarView);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {sidebarView === 'workspace' ? (
        <SidebarContent
          rootFolder={rootFolder}
          isLoading={isLoading}
          currentNotePath={currentNotePath}
          createNote={createNote}
          createFolder={createFolder}
          isPeeking={isPeeking}
        />
      ) : (
        <NotesOutline
          enabled={Boolean(currentNotePath)}
          className={cn(
            'min-h-0 flex-1 px-2',
            isPeeking ? 'pt-3' : 'pt-1',
          )}
        />
      )}
    </div>
  );
}
