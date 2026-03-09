import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { TreeItemContextMenu, TreeItemMenuAction, TreeItemMenuDivider } from './TreeItemContextMenu';

interface FileItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  isStarred: boolean;
  onRename: () => void;
  onOpenNewTab: () => void;
  onToggleStar: () => void;
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
  onDelete,
}: FileItemMenuProps) {
  return (
    <TreeItemContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <TreeItemMenuAction
        icon={<Icon name="common.compose" size="md" />}
        label="Rename"
        onClick={onRename}
      />
      <TreeItemMenuAction
        icon={<Icon name="nav.external" size="md" />}
        label="Open in new tab"
        onClick={onOpenNewTab}
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
