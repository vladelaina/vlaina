import { memo, useEffect, useRef } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { useToastStore } from '@/stores/useToastStore';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { NoteFile } from '@/stores/useNotesStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { FileItemMenu } from './components/FileItemMenu';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFileItemState } from './hooks/useFileItemState';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { copyTreeItemPath, openTreeItemLocation } from './pathActions';
import { scrollSidebarItemIntoView } from '../common/sidebarScrollIntoView';
import {
  clearHoveredSidebarRenamePath,
  registerSidebarHoverRenameTarget,
  setHoveredSidebarRenamePath,
} from '../common/sidebarHoverRename';

interface FileItemProps {
  node: NoteFile;
  depth: number;
  currentNotePath?: string;
  showStarBadge?: boolean;
}

export const FileItem = memo(function FileItem({
  node,
  depth,
  currentNotePath,
  showStarBadge = false,
}: FileItemProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isRenamingRef = useRef(false);
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
  const isNewlyCreated = useNotesStore((state) => state.isNewlyCreated);
  const notesPath = useNotesStore((state) => state.notesPath);

  const displayName = useDisplayName(node.path) || node.name;
  const noteIcon = useDisplayIcon(node.path);
  const isActive = node.path === currentNotePath;

  useEffect(() => {
    isRenamingRef.current = isRenaming;
  }, [isRenaming]);

  useEffect(() => {
    return registerSidebarHoverRenameTarget(node.path, {
      startRename: () => {
        setIsRenaming(true);
        setShowMenu(false);
      },
      cancelRename: () => {
        setIsRenaming(false);
      },
      isRenaming: () => isRenamingRef.current,
    });
  }, [node.path, setIsRenaming, setShowMenu]);

  useEffect(() => {
    if (!isNewlyCreated || !isActive) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollSidebarItemIntoView(node.path);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isActive, isNewlyCreated, node.path]);

  return (
    <div className="relative" data-file-tree-path={node.path} data-file-tree-kind="file">
      <NotesSidebarRow
        depth={depth}
        actionFadeClassName={showStarBadge ? 'w-3 from-transparent' : undefined}
        onMouseEnter={() => setHoveredSidebarRenamePath(node.path)}
        onMouseLeave={() => clearHoveredSidebarRenamePath(node.path)}
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
            <div className={cn('relative min-w-0', showStarBadge && 'pr-5')}>
              <NoteDisambiguatedTitle
                path={node.path}
                fallbackName={displayName}
                className={cn(isActive && 'text-[var(--notes-sidebar-text)]')}
                titleClassName={cn(isActive && 'font-medium')}
                hintClassName="text-[var(--notes-sidebar-text-soft)]"
              />
              {showStarBadge ? (
                <SidebarStarBadge
                  ariaLabel={isItemStarred ? 'Remove from Starred' : 'Add to Starred'}
                  onClick={() => toggleStarred(node.path)}
                />
              ) : null}
            </div>
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
        onCopyPath={async () => {
          setShowMenu(false);
          try {
            await copyTreeItemPath(notesPath, node.path);
          } catch (error) {
            useToastStore.getState().addToast(
              error instanceof Error ? error.message : 'Failed to copy path.',
              'error'
            );
          }
        }}
        onOpenFileLocation={async () => {
          setShowMenu(false);
          try {
            await openTreeItemLocation(notesPath, node.path);
          } catch (error) {
            useToastStore.getState().addToast(
              error instanceof Error ? error.message : 'Failed to open file location.',
              'error'
            );
          }
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
    prevProps.currentNotePath === nextProps.currentNotePath &&
    prevProps.showStarBadge === nextProps.showStarBadge
  );
}
