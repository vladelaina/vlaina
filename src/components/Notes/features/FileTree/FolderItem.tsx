import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { FolderNode } from '@/stores/useNotesStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { useFolderItemState } from './hooks/useFolderItemState';
import { cn } from '@/lib/utils';
import {
  getSidebarLabelClass,
  getSidebarTextClass,
  SIDEBAR_LABEL_TEXT_METRICS_CLASS,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { TreeItemShell } from './components/TreeItemShell';
import { useTreeItemPathActions } from './hooks/useTreeItemPathActions';
import type { NotesSidebarMenuEntry } from '../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { useI18n } from '@/lib/i18n';

const TreeItemMenu = lazy(async () => {
  const mod = await import('./components/TreeItemMenu');
  return { default: mod.TreeItemMenu };
});
const TreeItemDeleteDialog = lazy(async () => {
  const mod = await import('./components/TreeItemDeleteDialog');
  return { default: mod.TreeItemDeleteDialog };
});

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  showStarBadge?: boolean;
  dragEnabled?: boolean;
  showMenuButton?: boolean;
  renderChildren?: boolean;
}

export function isCurrentNoteInsideFolder(currentNotePath: string | undefined, folderPath: string): boolean {
  if (!currentNotePath || !folderPath) {
    return false;
  }

  return currentNotePath.startsWith(`${folderPath}/`);
}

export const FolderItem = memo(function FolderItem({
  node,
  depth,
  showStarBadge = false,
  dragEnabled = true,
  showMenuButton = true,
  renderChildren = true,
}: FolderItemProps) {
  const { t } = useI18n();
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
  const [shouldRenderChildren, setShouldRenderChildren] = useState(node.expanded);
  const notesPath = useNotesStore((state) => state.notesPath);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path);
  const isCurrentNoteAncestor = isCurrentNoteInsideFolder(currentNotePath, node.path);
  const { handleCopyPath, handleOpenInNewWindow, handleOpenLocation } = useTreeItemPathActions({
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
      label: t('sidebar.rename'),
      onClick: () => {
        setIsRenaming(true);
        setShowMenu(false);
      },
    },
    {
      key: 'new-note',
      icon: <Icon name="file.add" size="md" />,
      label: t('sidebar.newNote'),
      onClick: async () => {
        await createNote(node.path);
        setShowMenu(false);
      },
    },
    {
      key: 'toggle-star',
      icon: <Icon name="misc.star" size="md" className={isItemStarred ? 'fill-amber-500 text-amber-500' : undefined} />,
      label: isItemStarred ? t('sidebar.removeFromStarred') : t('sidebar.addToStarred'),
      onClick: () => {
        toggleFolderStarred(node.path);
        setShowMenu(false);
      },
    },
    {
      kind: 'submenu',
      key: 'more',
      icon: <Icon name="common.more" size="md" />,
      label: t('sidebar.more'),
      children: [
        {
          key: 'copy-path',
          icon: <Icon name="common.copy" size="md" />,
          label: t('sidebar.copyPath'),
          onClick: async () => {
            setShowMenu(false);
            await handleCopyPath();
          },
        },
        {
          key: 'open-new-window',
          icon: <Icon name="file.folderOutput" size="md" />,
          label: t('sidebar.openInNewWindow'),
          onClick: async () => {
            setShowMenu(false);
            await handleOpenInNewWindow('folder');
          },
        },
        {
          key: 'open-location',
          icon: <Icon name="file.folderOpenArrow" size="md" />,
          label: t('sidebar.openFolderLocation'),
          onClick: async () => {
            setShowMenu(false);
            await handleOpenLocation();
          },
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
      label: t('sidebar.moveToTrash'),
      onClick: () => {
        setShowMenu(false);
        setShowDeleteDialog(true);
      },
      danger: true,
    },
  ];

  useEffect(() => {
    if (!node.expanded) {
      setShouldRenderChildren(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setShouldRenderChildren(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [node.expanded]);

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
              'transition-none',
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
              className="absolute inset-0 opacity-0 transition-none group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
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
      showMenuButton={showMenuButton}
      menuButtonLabel="Open folder menu"
      onMenuClick={handleMenuTrigger}
      main={
        isRenaming ? (
          <SidebarInlineRenameInput
            value={renameValue}
            onValueChange={setRenameValue}
            onSubmit={handleRenameSubmit}
            onCancel={() => setIsRenaming(false)}
            className={cn(
              'w-full min-w-0 border-none bg-transparent p-0 outline-none',
              SIDEBAR_LABEL_TEXT_METRICS_CLASS,
              getSidebarTextClass('notes')
            )}
          />
        ) : (
          <div className={cn('relative min-w-0', showStarBadge && 'pr-5')}>
            <span className={cn('block whitespace-normal break-all', getSidebarLabelClass('notes', { selected: isCurrentNoteAncestor }))}>
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
      {showMenu ? (
        <Suspense fallback={null}>
          <TreeItemMenu isOpen={showMenu} onClose={() => setShowMenu(false)} position={menuPosition} entries={menuEntries} />
        </Suspense>
      ) : null}

      {renderChildren && node.expanded && shouldRenderChildren && node.children.length > 0 ? (
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
                showMenuButton={showMenuButton}
              />
            ) : (
              <FileItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentFolderPath={node.path}
                showStarBadge={false}
                dragEnabled={dragEnabled}
                showMenuButton={showMenuButton}
              />
            )
          )}
        </div>
      ) : null}

      {showDeleteDialog ? (
        <Suspense fallback={null}>
          <TreeItemDeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            itemLabel={node.name}
            itemType="Folder"
            onConfirm={() => deleteFolder(node.path)}
          />
        </Suspense>
      ) : null}
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
    prevProps.showStarBadge === nextProps.showStarBadge &&
    prevProps.dragEnabled === nextProps.dragEnabled &&
    prevProps.showMenuButton === nextProps.showMenuButton &&
    prevProps.renderChildren === nextProps.renderChildren
  );
}
