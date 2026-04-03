import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { NotesSidebarContextMenu } from '../../Sidebar/NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from '../../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { type NotesSidebarMenuPosition } from '../../Sidebar/context-menu/shared';

interface FileItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: NotesSidebarMenuPosition;
  isStarred: boolean;
  onRename: () => void;
  onOpenNewTab: () => void;
  onToggleStar: () => void;
  onCopyPath: () => void | Promise<unknown>;
  onOpenFileLocation: () => void | Promise<unknown>;
  onDelete: () => void;
}

export function FileItemMenu({
  isOpen,
  onClose,
  position,
  isStarred,
  onRename,
  onOpenNewTab,
  onToggleStar,
  onCopyPath,
  onOpenFileLocation,
  onDelete,
}: FileItemMenuProps) {
  const entries: NotesSidebarMenuEntry[] = [
    {
      key: 'rename',
      icon: <Icon name="common.compose" size="md" />,
      label: 'Rename',
      onClick: onRename,
    },
    {
      key: 'open-new-tab',
      icon: <Icon name="nav.external" size="md" />,
      label: 'Open in new tab',
      onClick: onOpenNewTab,
    },
    {
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
    },
    {
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
          key: 'open-file-location',
          icon: <Icon name="file.folderOpen" size="md" />,
          label: 'Open File Location',
          onClick: onOpenFileLocation,
        },
      ],
    },
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

  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuContent entries={entries} />
    </NotesSidebarContextMenu>
  );
}
