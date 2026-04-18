import { useUIStore } from '@/stores/uiSlice';
import { SidebarContent } from './SidebarContent';
import { NotesOutline } from './Outline';
import { NotesSidebarSurface } from './NotesSidebarPrimitives';
import { useNotesSidebarSearch } from './useNotesSidebarSearch';
import type { FolderNode } from '@/stores/useNotesStore';

interface NotesSidebarPanelProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => Promise<unknown>;
  createFolder: (path: string) => Promise<string | null>;
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
  const appViewMode = useUIStore((s) => s.appViewMode);
  const sidebarView = useUIStore((s) => s.notesSidebarView);
  const search = useNotesSidebarSearch(appViewMode === 'notes');

  return (
    <NotesSidebarSurface isPeeking={isPeeking} className="min-h-0">
      <div
        className={sidebarView === 'workspace' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        aria-hidden={sidebarView !== 'workspace'}
      >
        <SidebarContent
          rootFolder={rootFolder}
          isLoading={isLoading}
          currentNotePath={currentNotePath}
          createNote={createNote}
          createFolder={createFolder}
          search={search}
          isPeeking={isPeeking}
        />
      </div>
      <div
        className={sidebarView === 'outline' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        aria-hidden={sidebarView !== 'outline'}
      >
        <NotesOutline
          enabled={Boolean(currentNotePath) && sidebarView === 'outline'}
          isPeeking={isPeeking}
          className="min-h-0 flex-1"
        />
      </div>
    </NotesSidebarSurface>
  );
}
