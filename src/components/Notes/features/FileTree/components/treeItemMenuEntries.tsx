import { Icon } from '@/components/ui/icons';
import type { NotesSidebarMenuEntry } from '../../Sidebar/context-menu/NotesSidebarContextMenuContent';

interface TreeItemOpenLocationEntryOptions {
  label: string;
  onClose: () => void;
  onOpenLocation: () => void | Promise<unknown>;
}

export function createTreeItemOpenLocationEntry({
  label,
  onClose,
  onOpenLocation,
}: TreeItemOpenLocationEntryOptions): NotesSidebarMenuEntry {
  return {
    key: 'open-location',
    icon: <Icon name="file.folderOpenArrow" size="md" />,
    label,
    onClick: async () => {
      await onOpenLocation();
      onClose();
    },
  };
}
