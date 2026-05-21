import { lazy, Suspense } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { NotesSidebarSurface } from './NotesSidebarPrimitives';
import { useNotesSidebarSearch } from './useNotesSidebarSearch';
import type { FolderNode } from '@/stores/useNotesStore';

const SidebarContent = lazy(async () => {
  const mod = await import('./SidebarContent');
  return { default: mod.SidebarContent };
});

const NotesOutline = lazy(async () => {
  const mod = await import('./Outline');
  return { default: mod.NotesOutline };
});

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
  const effectiveSidebarView = sidebarView;

  return (
    <NotesSidebarSurface isPeeking={isPeeking} className="min-h-0">
      <div
        className={effectiveSidebarView === 'workspace' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        aria-hidden={effectiveSidebarView !== 'workspace'}
      >
        <Suspense fallback={null}>
          <SidebarContent
            rootFolder={rootFolder}
            isLoading={isLoading}
            currentNotePath={currentNotePath}
            createNote={createNote}
            createFolder={createFolder}
            search={search}
            isPeeking={isPeeking}
          />
        </Suspense>
      </div>
      <div
        className={effectiveSidebarView === 'outline' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        aria-hidden={effectiveSidebarView !== 'outline'}
      >
        <Suspense fallback={null}>
          <NotesOutline
            enabled={Boolean(currentNotePath) && effectiveSidebarView === 'outline'}
            isPeeking={isPeeking}
            className="min-h-0 flex-1"
          />
        </Suspense>
      </div>
    </NotesSidebarSurface>
  );
}
