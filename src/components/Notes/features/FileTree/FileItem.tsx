import { memo, useEffect } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { NoteFile } from '@/stores/useNotesStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFileItemState } from './hooks/useFileItemState';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { cn } from '@/lib/utils';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { scrollSidebarItemIntoView } from '../common/sidebarScrollIntoView';
import { TreeItemShell } from './components/TreeItemShell';
import {
  createTreeItemDeleteEntries,
  createTreeItemPathSubmenu,
  createTreeItemStarEntry,
  TreeItemMenu,
} from './components/TreeItemMenu';
import { useTreeItemPathActions } from './hooks/useTreeItemPathActions';
import type { NotesSidebarMenuEntry } from '../Sidebar/context-menu/NotesSidebarContextMenuContent';

interface FileItemProps {
  node: NoteFile;
  depth: number;
  showStarBadge?: boolean;
  dragEnabled?: boolean;
}

export const FileItem = memo(function FileItem({
  node,
  depth,
  showStarBadge = false,
  dragEnabled = true,
}: FileItemProps) {
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
  } = useFileItemState(node, dragEnabled);
  const isNewlyCreated = useNotesStore((state) => state.isNewlyCreated);
  const notesPath = useNotesStore((state) => state.notesPath);
  const { handleCopyPath, handleOpenLocation } = useTreeItemPathActions({
    notesPath,
    itemPath: node.path,
  });
  const isActive = useNotesStore((state) => state.currentNote?.path === node.path);

  const displayName = useDisplayName(node.path) || node.name;
  const noteIcon = useDisplayIcon(node.path);
  const menuEntries: NotesSidebarMenuEntry[] = [
    {
      key: 'rename',
      icon: <Icon name="common.compose" size="md" />,
      label: 'Rename',
      onClick: () => {
        setIsRenaming(true);
        setShowMenu(false);
      },
    },
    {
      key: 'open-new-tab',
      icon: <Icon name="nav.external" size="md" />,
      label: 'Open in new tab',
      onClick: () => {
        void openNote(node.path, true);
        setShowMenu(false);
      },
    },
    createTreeItemStarEntry(isItemStarred, () => {
      toggleStarred(node.path);
      setShowMenu(false);
    }),
    createTreeItemPathSubmenu({
      onCopyPath: async () => {
        setShowMenu(false);
        await handleCopyPath();
      },
      onOpenLocation: async () => {
        setShowMenu(false);
        await handleOpenLocation();
      },
      openLocationLabel: 'Open File Location',
    }),
    ...createTreeItemDeleteEntries(() => {
      setShowMenu(false);
      setShowDeleteDialog(true);
    }),
  ];

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
    <TreeItemShell
      itemPath={node.path}
      itemKind="file"
      depth={depth}
      actionFadeClassName={showStarBadge ? 'w-3 from-transparent' : undefined}
      leading={
        noteIcon ? (
          <NoteIcon icon={noteIcon} notePath={node.path} size={NOTES_SIDEBAR_ICON_SIZE} />
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
      menuButtonLabel="Open file menu"
      onMenuClick={handleMenuTrigger}
      isMenuButtonActive={showMenu || isActive}
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
    >
      <TreeItemMenu isOpen={showMenu} onClose={() => setShowMenu(false)} position={menuPosition} entries={menuEntries} />

      <TreeItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemLabel={node.name}
        itemType="Note"
        onConfirm={() => deleteNote(node.path)}
      />
    </TreeItemShell>
  );
}, areFileItemPropsEqual);

function areFileItemPropsEqual(prevProps: FileItemProps, nextProps: FileItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.depth === nextProps.depth &&
    prevProps.showStarBadge === nextProps.showStarBadge
  );
}
