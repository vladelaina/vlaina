import { memo } from 'react';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { FolderNode } from '@/stores/useNotesStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { TreeItemDeleteDialog } from './components/TreeItemDeleteDialog';
import { useFolderItemState } from './hooks/useFolderItemState';
import { cn } from '@/lib/utils';
import { getSidebarTextClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { TreeItemShell } from './components/TreeItemShell';
import {
  createTreeItemDeleteEntries,
  createTreeItemPathSubmenu,
  createTreeItemStarEntry,
  TreeItemMenu,
} from './components/TreeItemMenu';
import { useTreeItemPathActions } from './hooks/useTreeItemPathActions';
import type { NotesSidebarMenuEntry } from '../Sidebar/context-menu/NotesSidebarContextMenuContent';

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  showStarBadge?: boolean;
  dragEnabled?: boolean;
}

export const FolderItem = memo(function FolderItem({
  node,
  depth,
  showStarBadge = false,
  dragEnabled = true,
}: FolderItemProps) {
  const {
    showMenu,
    setShowMenu,
    menuPosition,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    isDragOver,
    showDeleteDialog,
    setShowDeleteDialog,
    isItemStarred,
    handleClick,
    handleContextMenu,
    handleMenuTrigger,
    handleRenameSubmit,
    dragHandlers,
    createNote,
    deleteFolder,
    toggleFolderStarred,
  } = useFolderItemState(node, dragEnabled);
  const hasChildren = node.children.length > 0;
  const notesPath = useNotesStore((state) => state.notesPath);
  const { handleCopyPath, handleOpenLocation } = useTreeItemPathActions({
    notesPath,
    itemPath: node.path,
    openLocationErrorMessage: 'Failed to open folder location.',
  });

  const leading = node.expanded ? (
    <Icon name="file.folderOpen" size={16} className="text-[var(--notes-sidebar-folder-icon)]" />
  ) : (
    <Icon name="file.folder" size={16} className="text-[var(--notes-sidebar-folder-icon)]" />
  );
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
      key: 'new-note',
      icon: <Icon name="file.add" size="md" />,
      label: 'New Note',
      onClick: async () => {
        await createNote(node.path);
        setShowMenu(false);
      },
    },
    createTreeItemStarEntry(isItemStarred, () => {
      toggleFolderStarred(node.path);
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
      openLocationLabel: 'Open Folder Location',
    }),
    ...createTreeItemDeleteEntries(() => {
      setShowMenu(false);
      setShowDeleteDialog(true);
    }),
  ];
  return (
    <TreeItemShell
      itemPath={node.path}
      itemKind="folder"
      depth={depth}
      actionFadeClassName={showStarBadge ? 'w-3 from-transparent' : undefined}
      contentClassName={showStarBadge ? 'z-30' : undefined}
      leading={
        <span className="relative flex size-[20px] items-center justify-center">
          <span
            className={cn(
              'transition-opacity duration-150',
              hasChildren && 'group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0',
            )}
          >
            {leading}
          </span>
          {hasChildren ? (
            <CollapseTriangleAffordance
              collapsed={!node.expanded}
              visibility="always"
              size={14}
              className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
              iconClassName="text-[var(--notes-sidebar-file-icon)]"
            />
          ) : null}
        </span>
      }
      isHighlighted={showMenu}
      isDragOver={isDragOver}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      dragHandlers={dragHandlers}
      showActionsByDefault={showMenu}
      menuButtonLabel="Open folder menu"
      onMenuClick={handleMenuTrigger}
      isMenuButtonActive={showMenu}
      main={
        isRenaming ? (
          <SidebarInlineRenameInput
            value={renameValue}
            onValueChange={setRenameValue}
            onSubmit={handleRenameSubmit}
            onCancel={() => setIsRenaming(false)}
            className={cn(
              'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
              getSidebarTextClass('notes')
            )}
          />
        ) : (
          <div className={cn('relative min-w-0', showStarBadge && 'pr-5')}>
            <span className={cn('block truncate', getSidebarTextClass('notes'))}>
              {node.name}
            </span>
            {showStarBadge ? (
              <SidebarStarBadge
                ariaLabel={isItemStarred ? 'Remove from Starred' : 'Add to Starred'}
                onClick={() => toggleFolderStarred(node.path)}
              />
            ) : null}
          </div>
        )
      }
    >
      <TreeItemMenu isOpen={showMenu} onClose={() => setShowMenu(false)} position={menuPosition} entries={menuEntries} />

      {node.expanded && node.children.length > 0 ? (
        <div>
          <div aria-hidden="true" className="h-2" />
          {node.children.map((child) =>
            child.isFolder ? (
              <FolderItem
                key={child.id}
                node={child}
                depth={depth + 1}
                showStarBadge={false}
                dragEnabled={dragEnabled}
              />
            ) : (
              <FileItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentFolderPath={node.path}
                showStarBadge={false}
                dragEnabled={dragEnabled}
              />
            )
          )}
        </div>
      ) : null}

      <TreeItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemLabel={node.name}
        itemType="Folder"
        onConfirm={() => deleteFolder(node.path)}
      />
    </TreeItemShell>
  );
}, areFolderItemPropsEqual);

function areFolderItemPropsEqual(prevProps: FolderItemProps, nextProps: FolderItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.node.expanded === nextProps.node.expanded &&
    prevProps.node.children === nextProps.node.children &&
    prevProps.depth === nextProps.depth &&
    prevProps.showStarBadge === nextProps.showStarBadge
  );
}
