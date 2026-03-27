import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';
import { SidebarActionButton } from '@/components/layout/sidebar/SidebarPrimitives';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

export function SidebarChatButton() {
  const setAppViewMode = useUIStore((s) => s.setAppViewMode);

  return (
    <SidebarActionButton
      onClick={() => setAppViewMode('chat')}
      icon={<Icon name="common.shootingStar" size={NOTES_SIDEBAR_ICON_SIZE} />}
      label="Spark"
      className="text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)]"
      iconClassName="text-[var(--chat-sidebar-text-muted)]"
    />
  );
}
