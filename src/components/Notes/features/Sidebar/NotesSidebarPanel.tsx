import { useCallback, useEffect } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { SidebarContent } from './SidebarContent';
import { NotesOutline } from './Outline';
import { NotesSidebarSurface } from './NotesSidebarPrimitives';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useNotesSidebarSearchState } from './notesSidebarSearch';
import type { FolderNode } from '@/stores/useNotesStore';

interface NotesSidebarPanelProps {
  rootFolder: FolderNode | null;
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
  const appViewMode = useUIStore((s) => s.appViewMode);
  const sidebarView = useUIStore((s) => s.notesSidebarView);
  const setSidebarView = useUIStore((s) => s.setNotesSidebarView);
  const { isSearchOpen, openSearch, closeSearch } = useNotesSidebarSearchState();

  const toggleSearch = useCallback(() => {
    if (isSearchOpen) {
      closeSearch();
      return;
    }

    setSidebarView('workspace');
    openSearch();
  }, [closeSearch, isSearchOpen, openSearch, setSidebarView]);

  useGlobalSearch(toggleSearch, appViewMode === 'notes');

  useEffect(() => {
    closeSearch();
  }, [closeSearch, sidebarView]);

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
