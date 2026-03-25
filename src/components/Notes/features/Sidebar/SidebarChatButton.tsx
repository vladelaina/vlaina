import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';

export function SidebarChatButton() {
  const setAppViewMode = useUIStore((s) => s.setAppViewMode);

  return (
    <button
      type="button"
      onClick={() => setAppViewMode('chat')}
      className="flex min-h-9 w-full items-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-[var(--chat-sidebar-text-muted)] shadow-none transition-colors hover:bg-[var(--notes-sidebar-row-hover)] hover:shadow-none"
    >
      <Icon name="common.shootingStar" size="md" className="text-[var(--chat-sidebar-text-muted)]" />
      <span className="truncate">Spark</span>
    </button>
  );
}
