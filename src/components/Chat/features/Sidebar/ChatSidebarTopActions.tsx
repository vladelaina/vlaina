import { type ReactNode } from 'react';
import {
  SidebarActionButton,
  SidebarActionGroup,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import { useI18n } from '@/lib/i18n';

interface ChatSidebarTopActionsProps {
  onOpenNewChat: () => void;
  showAppViewModeSwitch?: boolean;
}

interface ChatSidebarTopAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

export function ChatSidebarTopActions({
  onOpenNewChat,
  showAppViewModeSwitch = true,
}: ChatSidebarTopActionsProps) {
  const { t } = useI18n();
  const actions: ChatSidebarTopAction[] = [
    {
      key: 'new-chat',
      label: t('sidebar.newChat'),
      onClick: onOpenNewChat,
    },
  ];

  return (
    <SidebarActionGroup>
      {showAppViewModeSwitch ? <AppViewModeSwitch /> : null}
      {actions.map((action) => (
        <SidebarActionButton
          key={action.key}
          tone="chat"
          onClick={action.onClick}
          icon={action.icon}
          label={action.label}
          iconClassName="text-[var(--notes-sidebar-file-icon)]"
        />
      ))}
    </SidebarActionGroup>
  );
}
