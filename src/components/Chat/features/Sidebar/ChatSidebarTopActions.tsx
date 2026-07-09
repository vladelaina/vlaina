import {
  SidebarActionButton,
  SidebarActionGroup,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { themeIconTokens } from '@/styles/themeTokens';

interface ChatSidebarTopActionsProps {
  onOpenNewChat: () => void;
  showAppViewModeSwitch?: boolean;
}

export function ChatSidebarTopActions({
  onOpenNewChat,
  showAppViewModeSwitch = true,
}: ChatSidebarTopActionsProps) {
  const { t } = useI18n();

  return (
    <SidebarActionGroup>
      {showAppViewModeSwitch ? <AppViewModeSwitch /> : null}
      <SidebarActionButton
        data-chat-sidebar-action="new-chat"
        tone="chat"
        onClick={onOpenNewChat}
        icon={<Icon name="common.add" size={themeIconTokens.sizeCompact} />}
        label={t('sidebar.newChat')}
      />
    </SidebarActionGroup>
  );
}
