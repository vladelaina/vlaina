import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { TreeItemContextMenu, TreeItemMenuAction, TreeItemMenuDivider } from './TreeItemContextMenu';

interface FolderItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  isStarred: boolean;
  onRename: () => void;
  onNewNote: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
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
    <TreeItemContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <TreeItemMenuAction
        icon={<Icon name="common.compose" size="md" />}
        label="Rename"
        onClick={onRename}
      />
      <TreeItemMenuAction
        icon={<Icon name="file.add" size="md" />}
        label="New Note"
        onClick={onNewNote}
      />
      <TreeItemMenuAction
        icon={
          <Icon
            name="misc.star"
            size="md"
            className={isStarred ? 'fill-amber-500 text-amber-500' : undefined}
          />
        }
        label={isStarred ? 'Remove from Favorites' : 'Add to Favorites'}
        onClick={onToggleStar}
      />
      <TreeItemMenuDivider />
      <TreeItemMenuAction
        icon={<DeleteIcon />}
        label="Move to Trash"
        onClick={onDelete}
        danger
      />
    </TreeItemContextMenu>
  );
}
