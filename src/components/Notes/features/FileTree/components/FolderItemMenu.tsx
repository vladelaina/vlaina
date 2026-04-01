import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import {
  NotesSidebarContextMenu,
  NotesSidebarContextMenuDivider,
  NotesSidebarContextMenuItem,
} from '../../Sidebar/NotesSidebarContextMenu';

interface FolderItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  isStarred: boolean;
  onRename: () => void | Promise<unknown>;
  onNewNote: () => void | Promise<unknown>;
  onToggleStar: () => void | Promise<unknown>;
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
  onDelete,
}: FolderItemMenuProps) {
  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuItem
        icon={<Icon name="common.compose" size="md" />}
        label="Rename"
        onClick={onRename}
      />
      <NotesSidebarContextMenuItem
        icon={<Icon name="file.add" size="md" />}
        label="New Note"
        onClick={onNewNote}
      />
      <NotesSidebarContextMenuItem
        icon={
          <Icon
            name="misc.star"
            size="md"
            className={isStarred ? 'fill-amber-500 text-amber-500' : undefined}
          />
        }
        label={isStarred ? 'Remove from Starred' : 'Add to Starred'}
        onClick={onToggleStar}
      />
      <NotesSidebarContextMenuDivider />
      <NotesSidebarContextMenuItem
        icon={<DeleteIcon />}
        label="Move to Trash"
        onClick={onDelete}
        danger
      />
    </NotesSidebarContextMenu>
  );
}
