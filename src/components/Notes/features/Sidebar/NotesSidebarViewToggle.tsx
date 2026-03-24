import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';

export function NotesSidebarViewToggle() {
  const notesSidebarView = useUIStore((s) => s.notesSidebarView);
  const setNotesSidebarView = useUIStore((s) => s.setNotesSidebarView);
  const nextView = notesSidebarView === 'workspace' ? 'outline' : 'workspace';

  return (
    <button
      type="button"
      onClick={() => setNotesSidebarView(nextView)}
      className="flex min-h-9 w-full items-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-[var(--notes-sidebar-text-muted)] shadow-none transition-colors hover:bg-[var(--notes-sidebar-row-hover)] hover:shadow-none"
    >
      <Icon
        name={notesSidebarView === 'workspace' ? 'common.list' : 'file.folderOpen'}
        size="md"
        className="text-[var(--notes-sidebar-text-muted)]"
      />
      <span className="truncate">
        {notesSidebarView === 'workspace' ? 'Outline' : 'Files'}
      </span>
    </button>
  );
}
