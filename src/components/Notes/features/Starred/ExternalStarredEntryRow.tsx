import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { SidebarRowActionButton } from '@/components/layout/sidebar/SidebarRow';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { StarredEntry } from '@/stores/notes/types';
import { getStarredNoteDisplayPath } from '@/stores/notes/starred';
import { joinPath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import type { NotesSidebarMenuEntry } from '../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { useTreeItemPathActions } from '../FileTree/hooks/useTreeItemPathActions';
import { getSidebarContextMenuPosition } from '../common/sidebarMenuPosition';
import { getEntryTitle } from './starredSectionUtils';
import { useStarredEntryIcon } from './useStarredEntryIcon';
import { useI18n } from '@/lib/i18n';
import { themeIconTokens } from '@/styles/themeTokens';

const NotesSidebarContextMenu = lazy(async () => {
  const mod = await import('../Sidebar/NotesSidebarContextMenu');
  return { default: mod.NotesSidebarContextMenu };
});
const NotesSidebarContextMenuContent = lazy(async () => {
  const mod = await import('../Sidebar/context-menu/NotesSidebarContextMenuContent');
  return { default: mod.NotesSidebarContextMenuContent };
});

const STARRED_ROW_CLICK_DELAY_MS = 180;

interface ExternalStarredEntryRowProps {
  entry: StarredEntry;
  isCurrentVaultEntry: boolean;
  isActive: boolean;
  onOpen: (openInNewTab?: boolean) => void;
  onRemove: () => void;
}

export function ExternalStarredEntryRow({
  entry,
  isCurrentVaultEntry,
  isActive,
  onOpen,
  onRemove,
}: ExternalStarredEntryRowProps) {
  const { t } = useI18n();
  const displayPath = getStarredNoteDisplayPath(entry, isCurrentVaultEntry);
  const liveTitle = useDisplayName(displayPath);
  const liveIcon = useDisplayIcon(displayPath);
  const starredIcon = useStarredEntryIcon(entry, !liveIcon);
  const displayIcon = liveIcon || starredIcon;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const clickTimerRef = useRef<number | null>(null);
  const renameNote = useNotesStore((state) => state.renameNote);
  const renameAbsoluteNote = useNotesStore((state) => state.renameAbsoluteNote);
  const title = liveTitle || getEntryTitle(entry);
  const canOpen = entry.kind === 'note';
  const canRename = entry.kind === 'note';
  const { handleCopyPath, handleOpenInNewWindow, handleOpenLocation } = useTreeItemPathActions({
    notesPath: entry.vaultPath,
    itemPath: entry.relativePath,
    openLocationErrorMessage: entry.kind === 'folder'
      ? 'Failed to open folder location.'
      : 'Failed to open file location.',
  });

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition(
      getSidebarContextMenuPosition(
        event.currentTarget.getBoundingClientRect(),
        event.clientY,
        event.clientX,
      ),
    );
    setShowMenu(true);
  };

  const cancelPendingClick = useCallback(() => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelPendingClick(), [cancelPendingClick]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(title);
    }
  }, [isRenaming, title]);

  const startRename = useCallback(() => {
    if (!canRename) {
      return;
    }

    cancelPendingClick();
    setRenameValue(title);
    setShowMenu(false);
    setIsRenaming(true);
  }, [canRename, cancelPendingClick, title]);

  const submitRename = useCallback(async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      if (isCurrentVaultEntry) {
        await renameNote(entry.relativePath, trimmedValue);
      } else {
        const absolutePath = await joinPath(entry.vaultPath, entry.relativePath);
        await renameAbsoluteNote(absolutePath, trimmedValue);
      }
    }
    setIsRenaming(false);
  }, [
    entry.relativePath,
    entry.vaultPath,
    isCurrentVaultEntry,
    renameAbsoluteNote,
    renameNote,
    renameValue,
    title,
  ]);

  const handleMenuTrigger = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rowElement = event.currentTarget.closest('[data-starred-entry-id]');
    const rect = rowElement?.getBoundingClientRect();
    setMenuPosition(rect ? getSidebarContextMenuPosition(rect, event.clientY) : { top: event.clientY, left: event.clientX });
    setShowMenu((prev) => !prev);
  };

  const menuEntries: NotesSidebarMenuEntry[] = [
    ...(canRename
      ? [{
          key: 'rename',
          icon: <Icon name="common.compose" size="md" />,
          label: t('sidebar.rename'),
          onClick: startRename,
        } satisfies NotesSidebarMenuEntry]
      : []),
    ...(canOpen
      ? [{
          key: 'open-new-tab',
          icon: <Icon name="nav.external" size="md" />,
          label: t('sidebar.openInNewTab'),
          onClick: () => {
            onOpen(true);
            setShowMenu(false);
          },
        } satisfies NotesSidebarMenuEntry]
      : []),
    {
      key: 'remove-starred',
      icon: <Icon name="misc.star" size="md" className="fill-[var(--vlaina-color-favorite-fg)] text-[var(--vlaina-color-favorite-fg)]" />,
      label: t('sidebar.removeFromStarred'),
      onClick: () => {
        onRemove();
        setShowMenu(false);
      },
    } satisfies NotesSidebarMenuEntry,
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
            await handleOpenInNewWindow(entry.kind === 'folder' ? 'folder' : 'file');
          },
        },
        {
          key: 'open-location',
          icon: <Icon name="file.folderOpenArrow" size="md" />,
          label: entry.kind === 'folder' ? t('sidebar.openFolderLocation') : t('sidebar.openFileLocation'),
          onClick: async () => {
            setShowMenu(false);
            await handleOpenLocation(entry.kind === 'folder' ? 'folder' : 'file');
          },
        },
      ],
    },
  ];

  return (
    <>
      <NotesSidebarRow
        data-starred-entry-id={entry.id}
        data-starred-entry-kind={entry.kind}
        data-starred-entry-path={entry.relativePath}
        data-starred-entry-vault-path={entry.vaultPath}
        leading={
          entry.kind === 'note' ? (
            displayIcon ? (
              <NoteIcon
                icon={displayIcon}
                notePath={entry.relativePath}
                vaultPath={entry.vaultPath}
                size={themeIconTokens.sizeRow}
              />
            ) : (
              <Icon
                name="file.text"
                size={NOTES_SIDEBAR_ICON_SIZE}
                className="text-[var(--vlaina-sidebar-notes-file-icon)]"
              />
            )
          ) : (
            <Icon
              name="file.folder"
              size={themeIconTokens.sizeRow}
              className="text-[var(--vlaina-sidebar-notes-folder-icon)]"
            />
          )
        }
        isActive={isActive}
        isHighlighted={showMenu}
        showActionsByDefault={showMenu}
        onClick={canOpen ? (event) => {
          if (isRenaming) {
            return;
          }
          cancelPendingClick();
          const openInNewTab = event.ctrlKey || event.metaKey;
          clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            onOpen(openInNewTab);
          }, STARRED_ROW_CLICK_DELAY_MS);
        } : undefined}
        onDoubleClick={canRename ? (event) => {
          event.preventDefault();
          event.stopPropagation();
          startRename();
        } : undefined}
        onContextMenu={handleContextMenu}
        actions={
          <SidebarRowActionButton
            aria-label={t('notes.openStarredItemMenu')}
            onClick={handleMenuTrigger}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              'text-[var(--vlaina-sidebar-notes-text)] hover:text-[var(--vlaina-sidebar-row-selected-text)]',
            )}
          >
            <Icon name="common.more" size="md" />
          </SidebarRowActionButton>
        }
        main={
          <div className="relative min-w-0">
            {isRenaming ? (
              <SidebarInlineRenameInput
                value={renameValue}
                onValueChange={setRenameValue}
                onSubmit={submitRename}
                onCancel={() => setIsRenaming(false)}
                className={cn(
                  'w-full min-w-0 border-none bg-transparent p-0 outline-none',
                  getSidebarLabelClass('notes', { selected: isActive }),
                )}
              />
            ) : (
              <span className={getSidebarLabelClass('notes', { selected: isActive })}>
                {title}
              </span>
            )}
          </div>
        }
      />

      {showMenu ? (
        <Suspense fallback={null}>
          <NotesSidebarContextMenu
            isOpen={showMenu}
            onClose={() => setShowMenu(false)}
            position={menuPosition}
          >
            <NotesSidebarContextMenuContent entries={menuEntries} />
          </NotesSidebarContextMenu>
        </Suspense>
      ) : null}
    </>
  );
}
