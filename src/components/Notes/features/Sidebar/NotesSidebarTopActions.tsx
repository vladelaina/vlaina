import { type ReactNode } from 'react';
import { SidebarActionButton, SidebarActionGroup } from '@/components/layout/sidebar/SidebarPrimitives';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import { useUIStore } from '@/stores/uiSlice';
import { useI18n } from '@/lib/i18n';

interface NotesSidebarTopAction {
  key: string;
  label: string;
  icon?: ReactNode;
  iconClassName?: string;
  onClick: () => void;
}

export function NotesSidebarTopActions() {
  const { t } = useI18n();
  const notesSidebarView = useUIStore((state) => state.notesSidebarView);
  const setNotesSidebarView = useUIStore((state) => state.setNotesSidebarView);
  const nextView = notesSidebarView === 'workspace' ? 'outline' : 'workspace';

  const actions: NotesSidebarTopAction[] = [
    {
      key: 'toggle-view',
      label: notesSidebarView === 'workspace' ? t('sidebar.outline') : t('sidebar.files'),
      onClick: () => setNotesSidebarView(nextView),
    },
  ];

  return (
    <SidebarActionGroup>
      <AppViewModeSwitch />
      {actions.map((action) => (
        <SidebarActionButton
          key={action.key}
          tone="notes"
          onClick={action.onClick}
          icon={action.icon}
          label={action.label}
          iconClassName={action.iconClassName}
          className="rounded-[var(--vlaina-notes-ui-radius-compact)] text-[length:var(--vlaina-notes-ui-font-compact)]"
        />
      ))}
    </SidebarActionGroup>
  );
}
