import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { NotesSidebarContextMenu } from '../../Sidebar/NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from '../../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { type NotesSidebarMenuPosition } from '../../Sidebar/context-menu/shared';

interface FolderItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: NotesSidebarMenuPosition;
  isStarred: boolean;
  onRename: () => void | Promise<unknown>;
  onNewNote: () => void | Promise<unknown>;
  onToggleStar: () => void | Promise<unknown>;
  onCopyPath: () => void | Promise<unknown>;
  onOpenFolderLocation: () => void | Promise<unknown>;
  onDelete: () => void | Promise<unknown>;
}

export function FolderItemMenu({
  isOpen,
  onClose,
  position,
  isStarred,
  onRename,
  onNewNote,
  onToggleStar,
  onCopyPath,
  onOpenFolderLocation,
  onDelete,
}: FolderItemMenuProps) {
  const entries: NotesSidebarMenuEntry[] = [
    {
      key: 'rename',
      icon: <Icon name="common.compose" size="md" />,
      label: 'Rename',
      onClick: onRename,
    },
    {
      key: 'new-note',
      icon: <Icon name="file.add" size="md" />,
      label: 'New Note',
      onClick: onNewNote,
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
          key: 'open-folder-location',
          icon: <Icon name="file.folderOpen" size="md" />,
          label: 'Open Folder Location',
          onClick: onOpenFolderLocation,
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
