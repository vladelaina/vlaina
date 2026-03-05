import { useNotesStore } from '@/stores/notes/useNotesStore';
import { NotesSidebarPanel } from './NotesSidebarPanel';

export function NotesSidebarWrapper({ isPeeking = false }: { isPeeking?: boolean }) {
  const rootFolder = useNotesStore(s => s.rootFolder);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isLoading = useNotesStore(s => s.isLoading);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);

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
