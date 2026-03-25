import { memo, useRef } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import type { NoteFile } from '@/stores/useNotesStore';
import { FileItemMenu } from './components/FileItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFileItemState } from './hooks/useFileItemState';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';

interface FileItemProps {
  node: NoteFile;
  depth: number;
  currentNotePath?: string;
}

export const FileItem = memo(function FileItem({
  node,
  depth,
  currentNotePath,
}: FileItemProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    showDeleteDialog,
    setShowDeleteDialog,
    isItemStarred,
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers,
    openNote,
    deleteNote,
    toggleStarred,
  } = useFileItemState(node);

  const displayName = useDisplayName(node.path) || node.name;
  const noteIcon = useDisplayIcon(node.path);
  const isActive = node.path === currentNotePath;

  return (
    <div className="relative" data-file-tree-path={node.path} data-file-tree-kind="file">
      <NotesSidebarRow
        depth={depth}
        leading={
          noteIcon ? (
            <NoteIcon icon={noteIcon} size="sidebar" />
          ) : (
            <Icon name="file.text" size="sidebar" className="text-[var(--notes-sidebar-file-icon)]" />
          )
        }
        isActive={isActive}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        dragHandlers={dragHandlers}
        main={
          isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => void handleRenameSubmit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleRenameSubmit();
                if (event.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full min-w-0 rounded border border-[var(--vlaina-accent)] bg-transparent px-1.5 py-0.5 text-sm leading-5 text-gray-900 outline-none dark:text-gray-100"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span className={cn('block truncate', isActive && 'font-medium text-[var(--notes-sidebar-text)]')}>
              {displayName}
            </span>
          )
        }
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open file menu"
            onClick={(event) => {
              event.stopPropagation();
              if (!menuButtonRef.current) return;
              handleMenuTrigger(event, menuButtonRef.current.getBoundingClientRect());
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              isActive
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
        }
      />

      <FileItemMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
        isStarred={isItemStarred}
        onRename={() => {
          setIsRenaming(true);
          setShowMenu(false);
        }}
        onOpenNewTab={() => {
          void openNote(node.path, true);
          setShowMenu(false);
        }}
        onToggleStar={() => {
          toggleStarred(node.path);
          setShowMenu(false);
        }}
        onDelete={() => {
          setShowMenu(false);
          setShowDeleteDialog(true);
        }}
      />

      <TreeItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemLabel={node.name}
        itemType="Note"
        onConfirm={() => deleteNote(node.path)}
      />
    </div>
  );
}, areFileItemPropsEqual);

function areFileItemPropsEqual(prevProps: FileItemProps, nextProps: FileItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.depth === nextProps.depth &&
    prevProps.currentNotePath === nextProps.currentNotePath
  );
}
