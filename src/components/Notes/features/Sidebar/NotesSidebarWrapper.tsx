import { useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { NotesSidebarPanel } from './NotesSidebarPanel';

export function NotesSidebarWrapper({ isPeeking = false }: { isPeeking?: boolean }) {
  const rootFolder = useNotesStore(s => s.rootFolder);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isLoading = useNotesStore(s => s.isLoading);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);
  const starredLoaded = useNotesStore(s => s.starredLoaded);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const currentVault = useVaultStore((s) => s.currentVault);

  useEffect(() => {
    if (currentVault || starredLoaded) {
      return;
    }

    void loadStarred('');
  }, [currentVault, loadStarred, starredLoaded]);

  return (
    <NotesSidebarPanel
      rootFolder={rootFolder}
      isLoading={isLoading}
      currentNotePath={currentNotePath}
      createNote={() => createNote()}
      createFolder={(path: string) => createFolder(path)}
      isPeeking={isPeeking}
    />
  );
}
