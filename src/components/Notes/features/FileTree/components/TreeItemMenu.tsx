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
  onOpenInNewWindow: () => void | Promise<unknown>;
  onOpenLocation: () => void | Promise<unknown>;
  openLocationLabel: string;
  labels: {
    addToStarred: string;
    copyPath: string;
    more: string;
    moveToTrash: string;
    openInNewWindow: string;
    removeFromStarred: string;
  };
}

export function createTreeItemStarEntry(
  isStarred: boolean,
  onToggleStar: () => void | Promise<unknown>,
  labels: Pick<TreeItemPathSubmenuOptions['labels'], 'addToStarred' | 'removeFromStarred'>,
): NotesSidebarMenuEntry {
  return {
    key: 'toggle-star',
    icon: (
      <Icon
        name="misc.star"
        size="md"
        className={isStarred ? 'fill-[var(--vlaina-color-favorite-fg)] text-[var(--vlaina-color-favorite-fg)]' : undefined}
      />
    ),
    label: isStarred ? labels.removeFromStarred : labels.addToStarred,
    onClick: onToggleStar,
  };
}

export function createTreeItemPathSubmenu({
  onCopyPath,
  onOpenInNewWindow,
  onOpenLocation,
  openLocationLabel,
  labels,
}: TreeItemPathSubmenuOptions): NotesSidebarMenuEntry {
  return {
    kind: 'submenu',
    key: 'more',
    icon: <Icon name="common.more" size="md" />,
    label: labels.more,
    children: [
      {
        key: 'copy-path',
        icon: <Icon name="common.copy" size="md" />,
        label: labels.copyPath,
        onClick: onCopyPath,
      },
      {
        key: 'open-new-window',
        icon: <Icon name="file.folderOutput" size="md" />,
        label: labels.openInNewWindow,
        onClick: onOpenInNewWindow,
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
  label: string,
): NotesSidebarMenuEntry[] {
  return [
    {
      kind: 'divider',
      key: 'divider-danger',
    },
    {
      key: 'delete',
      icon: <DeleteIcon />,
      label,
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
