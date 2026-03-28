import { memo, useRef } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { NoteFile } from '@/stores/useNotesStore';
import { FileItemMenu } from './components/FileItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFileItemState } from './hooks/useFileItemState';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';

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
            <NoteIcon icon={noteIcon} size={NOTES_SIDEBAR_ICON_SIZE} />
          ) : (
            <Icon name="file.text" size={NOTES_SIDEBAR_ICON_SIZE} className="text-[var(--notes-sidebar-file-icon)]" />
          )
        }
        isActive={isActive}
        isHighlighted={showMenu}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        dragHandlers={dragHandlers}
        showActionsByDefault={showMenu}
        main={
          isRenaming ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={handleRenameSubmit}
              onCancel={() => setIsRenaming(false)}
              className={cn(
                'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
                isActive || showMenu
                  ? 'font-medium text-[var(--notes-sidebar-text)]'
                  : 'text-[var(--notes-sidebar-text-muted)]'
              )}
            />
          ) : (
            <NoteDisambiguatedTitle
              path={node.path}
              fallbackName={displayName}
              className={cn(isActive && 'text-[var(--notes-sidebar-text)]')}
              titleClassName={cn(isActive && 'font-medium')}
              hintClassName="text-[var(--notes-sidebar-text-soft)]"
            />
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
              showMenu || isActive
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
