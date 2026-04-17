import { type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  SidebarActionButton,
  SidebarActionGroup,
} from '@/components/layout/sidebar/SidebarPrimitives';

interface ChatSidebarTopActionsProps {
  onOpenNewChat: () => void;
  onOpenNotes: () => void;
}

interface ChatSidebarTopAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

export function ChatSidebarTopActions({
  onOpenNewChat,
  onOpenNotes,
}: ChatSidebarTopActionsProps) {
  const actions: ChatSidebarTopAction[] = [
    {
      key: 'new-chat',
      label: 'New Chat',
      icon: <Icon name="common.compose" size="md" />,
      onClick: onOpenNewChat,
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: <Icon name="file.text" size="md" />,
      onClick: onOpenNotes,
    },
  ];

  return (
    <SidebarActionGroup>
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
