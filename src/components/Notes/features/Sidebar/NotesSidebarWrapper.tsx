import { lazy, Suspense, useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { NotesSidebarSurface } from './NotesSidebarPrimitives';

const NotesSidebarPanel = lazy(async () => {
  const mod = await import('./NotesSidebarPanel');
  return { default: mod.NotesSidebarPanel };
});

export function NotesSidebarWrapper({
  isPeeking = false,
  loadContent = true,
  active,
}: {
  isPeeking?: boolean;
  loadContent?: boolean;
  active?: boolean;
}) {
  const rootFolder = useNotesStore(s => s.rootFolder);
  const rootFolderPath = useNotesStore(s => s.rootFolderPath);
  const notesPath = useNotesStore(s => s.notesPath);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isLoading = useNotesStore(s => s.isLoading);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);
  const starredLoaded = useNotesStore(s => s.starredLoaded);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const currentNotesRoot = useNotesRootStore((s) => s.currentNotesRoot);

  useEffect(() => {
    if (currentNotesRoot || starredLoaded) {
      return;
    }

    void loadStarred('').catch(() => undefined);
  }, [currentNotesRoot, loadStarred, starredLoaded]);

  const isCurrentNotesRootRootPending = Boolean(
    currentNotesRoot &&
    notesPath === currentNotesRoot.path &&
    (!rootFolder || rootFolderPath !== currentNotesRoot.path),
  );

  if (!loadContent) {
    return <NotesSidebarSurface isPeeking={isPeeking} className="min-h-0" />;
  }

  return (
    <Suspense fallback={null}>
      <NotesSidebarPanel
        rootFolder={rootFolder}
        isLoading={isLoading || isCurrentNotesRootRootPending}
        currentNotePath={currentNotePath}
        createNote={(folderPath?: string) => createNote(folderPath, { asDraft: true })}
        createFolder={(path: string) => createFolder(path)}
        isPeeking={isPeeking}
        active={active}
      />
    </Suspense>
  );
}
