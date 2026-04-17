import { type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { SidebarActionButton, SidebarActionGroup } from '@/components/layout/sidebar/SidebarPrimitives';
import { useUIStore } from '@/stores/uiSlice';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

interface NotesSidebarTopAction {
  key: string;
  label: string;
  icon: ReactNode;
  iconClassName: string;
  onClick: () => void;
}

export function NotesSidebarTopActions() {
  const notesSidebarView = useUIStore((state) => state.notesSidebarView);
  const setNotesSidebarView = useUIStore((state) => state.setNotesSidebarView);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const nextView = notesSidebarView === 'workspace' ? 'outline' : 'workspace';

  const actions: NotesSidebarTopAction[] = [
    {
      key: 'toggle-view',
      label: notesSidebarView === 'workspace' ? 'Outline' : 'Files',
      icon: (
        <Icon
          name={notesSidebarView === 'workspace' ? 'common.list' : 'file.folderOpen'}
          size={NOTES_SIDEBAR_ICON_SIZE}
        />
      ),
      iconClassName: 'text-[var(--notes-sidebar-outline-icon)]',
      onClick: () => setNotesSidebarView(nextView),
    },
    {
      key: 'spark',
      label: 'Spark',
      icon: <Icon name="common.shootingStar" size={NOTES_SIDEBAR_ICON_SIZE} />,
      iconClassName: 'text-[var(--notes-sidebar-spark-icon)]',
      onClick: () => setAppViewMode('chat'),
    },
  ];

  return (
    <SidebarActionGroup>
      {actions.map((action) => (
        <SidebarActionButton
          key={action.key}
          tone="notes"
          onClick={action.onClick}
          icon={action.icon}
          label={action.label}
          iconClassName={action.iconClassName}
        />
      ))}
    </SidebarActionGroup>
  );
}
