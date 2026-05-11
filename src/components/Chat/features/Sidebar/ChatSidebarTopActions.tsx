import { type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  SidebarActionButton,
  SidebarActionGroup,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { useI18n } from '@/lib/i18n';

interface ChatSidebarTopActionsProps {
  onOpenNewChat: () => void;
  onOpenNotes?: () => void;
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
  const { t } = useI18n();
  const actions: ChatSidebarTopAction[] = [
    {
      key: 'new-chat',
      label: t('sidebar.newChat'),
      icon: <Icon name="common.compose" size="md" />,
      onClick: onOpenNewChat,
    },
  ];

  if (onOpenNotes) {
    actions.push({
      key: 'notes',
      label: t('sidebar.grimoire'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-book-image-icon lucide-book-image"
        >
          <path d="m20 13.7-2.1-2.1a2 2 0 0 0-2.8 0L9.7 17" />
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
          <circle cx="10" cy="8" r="2" />
        </svg>
      ),
      onClick: onOpenNotes,
    });
  }

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
