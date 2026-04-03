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
      {sidebarView === 'workspace' ? (
        <SidebarContent
          rootFolder={rootFolder}
          isLoading={isLoading}
          currentNotePath={currentNotePath}
          createNote={createNote}
          createFolder={createFolder}
          search={search}
          isPeeking={isPeeking}
        />
      ) : (
        <NotesOutline
          enabled={Boolean(currentNotePath)}
          isPeeking={isPeeking}
          className="min-h-0 flex-1"
        />
      )}
    </NotesSidebarSurface>
  );
}
