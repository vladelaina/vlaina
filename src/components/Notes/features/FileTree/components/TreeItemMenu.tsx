import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { NotesSidebarContextMenu } from '../../Sidebar/NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from '../../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { type NotesSidebarMenuPosition } from '../../Sidebar/context-menu/shared';

interface TreeItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: NotesSidebarMenuPosition;
  entries: NotesSidebarMenuEntry[];
}

interface TreeItemPathSubmenuOptions {
  onCopyPath: () => void | Promise<unknown>;
  onOpenLocation: () => void | Promise<unknown>;
  openLocationLabel: string;
}

export function createTreeItemStarEntry(
  isStarred: boolean,
  onToggleStar: () => void | Promise<unknown>,
): NotesSidebarMenuEntry {
  return {
    key: 'toggle-star',
    icon: (
      <Icon
        name="misc.star"
        size="md"
        className={isStarred ? 'fill-amber-500 text-amber-500' : undefined}
      />
    ),
    label: isStarred ? 'Remove from Starred' : 'Add to Starred',
    onClick: onToggleStar,
  };
}

export function createTreeItemPathSubmenu({
  onCopyPath,
  onOpenLocation,
  openLocationLabel,
}: TreeItemPathSubmenuOptions): NotesSidebarMenuEntry {
  return {
    kind: 'submenu',
    key: 'more',
    icon: <Icon name="common.more" size="md" />,
    label: 'More',
    children: [
      {
        key: 'copy-path',
        icon: <Icon name="common.copy" size="md" />,
        label: 'Copy Path',
        onClick: onCopyPath,
      },
      {
        key: 'open-location',
        icon: <Icon name="file.folderOpenArrow" size="md" />,
        label: openLocationLabel,
        onClick: onOpenLocation,
      },
    ],
  };
}

export function createTreeItemDeleteEntries(
  onDelete: () => void | Promise<unknown>,
): NotesSidebarMenuEntry[] {
  return [
    {
      kind: 'divider',
      key: 'divider-danger',
    },
    {
      key: 'delete',
      icon: <DeleteIcon />,
      label: 'Move to Trash',
      onClick: onDelete,
      danger: true,
    },
  ];
}

export function TreeItemMenu({
  isOpen,
  onClose,
  position,
  entries,
}: TreeItemMenuProps) {
  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuContent entries={entries} />
    </NotesSidebarContextMenu>
  );
}
