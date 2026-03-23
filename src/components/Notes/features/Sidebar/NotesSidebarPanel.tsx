import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { SidebarContent } from './SidebarContent';
import { NotesOutline } from './Outline';
import { NotesSidebarSurface } from './NotesSidebarPrimitives';

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
  const setSidebarView = useUIStore((s) => s.setNotesSidebarView);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setNotesSidebarSearchOpen = useUIStore((s) => s.setNotesSidebarSearchOpen);

  useEffect(() => {
    const handleOpenSearch = () => {
      const { notesSidebarSearchOpen } = useUIStore.getState();
      if (notesSidebarSearchOpen) {
        setNotesSidebarSearchOpen(false);
        setSearchQuery('');
        return;
      }

      setSidebarView('workspace');
      setNotesSidebarSearchOpen(true);
    };

    window.addEventListener('neko-open-search', handleOpenSearch);
    return () => window.removeEventListener('neko-open-search', handleOpenSearch);
  }, [setNotesSidebarSearchOpen, setSearchQuery, setSidebarView]);

  useEffect(() => {
    setNotesSidebarSearchOpen(false);
    setSearchQuery('');
  }, [setNotesSidebarSearchOpen, setSearchQuery, sidebarView]);

  return (
    <NotesSidebarSurface isPeeking={isPeeking} className="min-h-0">
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
          isPeeking={isPeeking}
          className="min-h-0 flex-1"
        />
      )}
    </NotesSidebarSurface>
  );
}
