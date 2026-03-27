import { Icon } from '@/components/ui/icons';
import {
  SidebarActionButton,
  SidebarActionGroup,
} from '@/components/layout/sidebar/SidebarPrimitives';

interface ChatSidebarTopActionsProps {
  onOpenNewChat: () => void;
  onOpenNotes: () => void;
}

export function ChatSidebarTopActions({
  onOpenNewChat,
  onOpenNotes,
}: ChatSidebarTopActionsProps) {
  return (
    <SidebarActionGroup>
      <SidebarActionButton
        onClick={onOpenNewChat}
        icon={<Icon name="common.compose" size="md" />}
        label="New Chat"
        className="text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--chat-sidebar-row-hover)]"
        iconClassName="text-[var(--chat-sidebar-text-muted)]"
      />
      <SidebarActionButton
        onClick={onOpenNotes}
        icon={<Icon name="file.text" size="md" />}
        label="Notes"
        className="text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--chat-sidebar-row-hover)]"
        iconClassName="text-[var(--chat-sidebar-text-muted)]"
      />
    </SidebarActionGroup>
  );
}
