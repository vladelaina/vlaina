import { useNotesStore } from '@/stores/notes/useNotesStore';
import { SidebarContent } from './SidebarContent';

export function NotesSidebarWrapper({ isPeeking = false }: { isPeeking?: boolean }) {
  const rootFolder = useNotesStore(s => s.rootFolder);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isLoading = useNotesStore(s => s.isLoading);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);

  // We can trigger search via event or store if needed
  // For now, let's dispatch a custom event that NotesView listens to, 
  // OR we can hoist the search state to UI store?
  // Let's use the event approach for now as it's decoupled.
  const handleSearchClick = () => {
    window.dispatchEvent(new Event('neko-open-search'));
  };

  return (
    <SidebarContent 
      onSearchClick={handleSearchClick}
      rootFolder={rootFolder}
      isLoading={isLoading}
      currentNotePath={currentNotePath}
      createNote={() => createNote()}
      createFolder={(path: string) => createFolder(path)}
      isPeeking={isPeeking}
    />
  );
}
