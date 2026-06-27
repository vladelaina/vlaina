import { lazy, memo, Suspense, useCallback, useEffect, type MouseEvent } from 'react';
import { useDisplayName } from '@/hooks/useTitleSync';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { NoteFile } from '@/stores/useNotesStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { useFileItemState } from './hooks/useFileItemState';
import { cn } from '@/lib/utils';
import {
  getSidebarLabelClass,
  getSidebarTextClass,
  SIDEBAR_LABEL_TEXT_METRICS_CLASS,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { useSidebarHoverPrefetch } from '@/components/layout/sidebar/useSidebarHoverPrefetch';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { scrollSidebarItemIntoView } from '../common/sidebarScrollIntoView';
import { SidebarLiveNoteFileIcon } from '../Sidebar/SidebarNoteFileIcon';
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

interface FileItemProps {
  node: NoteFile;
  depth: number;
  parentFolderPath?: string;
  showStarBadge?: boolean;
  dragEnabled?: boolean;
  showMenuButton?: boolean;
}

export const FileItem = memo(function FileItem({
  node,
  depth,
  parentFolderPath = '',
  showStarBadge = false,
  dragEnabled = true,
  showMenuButton = true,
}: FileItemProps) {
  const { t } = useI18n();
  const isDraftNote = isDraftNotePath(node.path);
  const effectiveDragEnabled = dragEnabled && !isDraftNote;
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
    cancelPendingClick,
    handleRenameSubmit,
    dragHandlers,
    openNote,
    duplicateNote,
    deleteNote,
    toggleStarred,
  } = useFileItemState(node, effectiveDragEnabled);
  const isNewlyCreated = useNotesStore((state) => state.isNewlyCreated);
  const notesPath = useNotesStore((state) => state.notesPath);
  const prefetchNote = useNotesStore((state) => state.prefetchNote);
  const cancelPrefetchNote = useNotesStore((state) => state.cancelPrefetchNote);
  const { handleCopyPath, handleOpenInNewWindow, handleOpenLocation } = useTreeItemPathActions({
    notesPath,
    itemPath: node.path,
  });
  const isActive = useNotesStore((state) => state.currentNote?.path === node.path);
  const cancelHoverPrefetch = useCallback(() => {
    cancelPrefetchNote(node.path);
  }, [cancelPrefetchNote, node.path]);
  const hoverPrefetch = useSidebarHoverPrefetch(
    useCallback(() => prefetchNote(node.path), [node.path, prefetchNote]),
    {
      enabled: !isDraftNote && !isActive && !isRenaming,
      cancel: cancelHoverPrefetch,
    },
  );

  const displayName = useDisplayName(node.path) || node.name;
  const handleRenameFromDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      isDraftNote ||
      target?.closest('button,a,input,textarea,select,[role="button"]')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    cancelPendingClick();
    setShowMenu(false);
    setIsRenaming(true);
  }, [cancelPendingClick, isDraftNote, setIsRenaming, setShowMenu]);
  const menuEntries: NotesSidebarMenuEntry[] = isDraftNote
    ? [
        {
          key: 'delete-draft',
          icon: <DeleteIcon />,
          label: t('sidebar.delete'),
          onClick: () => {
            setShowMenu(false);
            setShowDeleteDialog(true);
          },
          danger: true,
        },
      ]
    : [
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
          key: 'open-new-tab',
          icon: <Icon name="nav.external" size="md" />,
          label: t('sidebar.openInNewTab'),
          onClick: () => {
            void openNote(node.path, true).catch(() => undefined);
            setShowMenu(false);
          },
        },
        {
          key: 'toggle-star',
          icon: <Icon name="misc.star" size="md" className={isItemStarred ? 'fill-[var(--vlaina-color-favorite-fg)] text-[var(--vlaina-color-favorite-fg)]' : undefined} />,
          label: isItemStarred ? t('sidebar.removeFromStarred') : t('sidebar.addToStarred'),
          onClick: () => {
            toggleStarred(node.path);
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
              key: 'duplicate',
              icon: <Icon name="common.copy" size="md" />,
              label: t('sidebar.duplicate'),
              onClick: async () => {
                setShowMenu(false);
                await duplicateNote(node.path);
              },
            },
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
                await handleOpenInNewWindow('file');
              },
            },
            {
              key: 'open-location',
              icon: <Icon name="file.folderOpenArrow" size="md" />,
              label: t('sidebar.openFileLocation'),
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
      parentFolderPath={parentFolderPath}
      depth={depth}
      actionFadeClassName={showStarBadge ? 'w-3 from-transparent' : undefined}
      contentClassName={showStarBadge ? 'z-[var(--vlaina-z-30)]' : undefined}
      leading={<SidebarLiveNoteFileIcon notePath={node.path} size={NOTES_SIDEBAR_ICON_SIZE} />}
      isActive={isActive}
      isHighlighted={showMenu}
      onMouseEnter={hoverPrefetch.onMouseEnter}
      onMouseLeave={hoverPrefetch.onMouseLeave}
      onClick={handleClick}
      onDoubleClick={handleRenameFromDoubleClick}
      onContextMenu={handleContextMenu}
      dragHandlers={effectiveDragEnabled ? dragHandlers : undefined}
      showActionsByDefault={showMenu}
      showMenuButton={showMenuButton}
      menuButtonLabel="Open file menu"
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
              getSidebarLabelClass('notes', { selected: isActive || showMenu })
            )}
          />
        ) : (
          <div className={cn('relative min-w-0', showStarBadge && 'pr-5')}>
            <NoteDisambiguatedTitle
              path={node.path}
              fallbackName={displayName}
              className={getSidebarTextClass('notes')}
              titleClassName={getSidebarLabelClass('notes', { selected: isActive || showMenu })}
              hintClassName="text-[var(--vlaina-sidebar-notes-text-soft)]"
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
      {showMenu ? (
        <Suspense fallback={null}>
          <TreeItemMenu isOpen={showMenu} onClose={() => setShowMenu(false)} position={menuPosition} entries={menuEntries} />
        </Suspense>
      ) : null}

      {showDeleteDialog ? (
        <Suspense fallback={null}>
          <TreeItemDeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            itemLabel={displayName}
            itemType="Note"
            onConfirm={() => deleteNote(node.path)}
          />
        </Suspense>
      ) : null}
    </TreeItemShell>
  );
}, areFileItemPropsEqual);

function areFileItemPropsEqual(prevProps: FileItemProps, nextProps: FileItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.depth === nextProps.depth &&
    prevProps.parentFolderPath === nextProps.parentFolderPath &&
    prevProps.showStarBadge === nextProps.showStarBadge &&
    prevProps.dragEnabled === nextProps.dragEnabled &&
    prevProps.showMenuButton === nextProps.showMenuButton
  );
}
