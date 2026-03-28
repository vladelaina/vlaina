import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';
import { SidebarActionButton } from '@/components/layout/sidebar/SidebarPrimitives';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

export function NotesSidebarViewToggle() {
  const notesSidebarView = useUIStore((s) => s.notesSidebarView);
  const setNotesSidebarView = useUIStore((s) => s.setNotesSidebarView);
  const nextView = notesSidebarView === 'workspace' ? 'outline' : 'workspace';

  return (
    <SidebarActionButton
      onClick={() => setNotesSidebarView(nextView)}
      icon={
        <Icon
          name={notesSidebarView === 'workspace' ? 'common.list' : 'file.folderOpen'}
          size={NOTES_SIDEBAR_ICON_SIZE}
        />
      }
      label={notesSidebarView === 'workspace' ? 'Outline' : 'Files'}
      className="text-[var(--notes-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)]"
      iconClassName="text-[var(--notes-sidebar-text-muted)]"
    />
  );
}
