import { useState, type MouseEvent } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import type { StarredEntry } from '@/stores/notes/types';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NotesSidebarContextMenu } from '../Sidebar/NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from '../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { createTreeItemPathSubmenu } from '../FileTree/components/TreeItemMenu';
import { useTreeItemPathActions } from '../FileTree/hooks/useTreeItemPathActions';
import { getEntryTitle } from './starredSectionUtils';
import { useStarredEntryIcon } from './useStarredEntryIcon';

function getStarredNoteDisplayPath(entry: StarredEntry, isCurrentVaultEntry: boolean) {
  if (entry.kind !== 'note') {
    return undefined;
  }

  return isCurrentVaultEntry
    ? entry.relativePath
    : `${entry.vaultPath.replace(/\/+$/, '')}/${entry.relativePath}`;
}

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
  const displayPath = getStarredNoteDisplayPath(entry, isCurrentVaultEntry);
  const liveTitle = useDisplayName(displayPath);
  const liveIcon = useDisplayIcon(displayPath);
  const starredIcon = useStarredEntryIcon(entry, !liveIcon);
  const displayIcon = liveIcon || starredIcon;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const title = liveTitle || getEntryTitle(entry);
  const canOpen = entry.kind === 'note';
  const { handleCopyPath, handleOpenLocation } = useTreeItemPathActions({
    notesPath: entry.vaultPath,
    itemPath: entry.relativePath,
    openLocationErrorMessage: entry.kind === 'folder'
      ? 'Failed to open folder location.'
      : 'Failed to open file location.',
  });

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ top: event.clientY, left: event.clientX });
    setShowMenu(true);
  };

  const menuEntries: NotesSidebarMenuEntry[] = [
    ...(canOpen
      ? [{
          key: 'open-new-tab',
          icon: <Icon name="nav.external" size="md" />,
          label: 'Open in new tab',
          onClick: () => {
            onOpen(true);
            setShowMenu(false);
          },
        } satisfies NotesSidebarMenuEntry]
      : []),
    {
      key: 'remove-starred',
      icon: <Icon name="misc.star" size="md" className="fill-amber-500 text-amber-500" />,
      label: 'Remove from Starred',
      onClick: () => {
        onRemove();
        setShowMenu(false);
      },
    } satisfies NotesSidebarMenuEntry,
    createTreeItemPathSubmenu({
      onCopyPath: async () => {
        setShowMenu(false);
        await handleCopyPath();
      },
      onOpenLocation: async () => {
        setShowMenu(false);
        await handleOpenLocation();
      },
      openLocationLabel: entry.kind === 'folder' ? 'Open Folder Location' : 'Open File Location',
    }),
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
                size={16}
              />
            ) : (
              <Icon
                name="file.text"
                size={NOTES_SIDEBAR_ICON_SIZE}
                className="text-[var(--notes-sidebar-file-icon)]"
              />
            )
          ) : (
            <Icon
              name="file.folder"
              size={16}
              className="text-[var(--notes-sidebar-folder-icon)]"
            />
          )
        }
        isActive={isActive}
        isHighlighted={showMenu}
        showActionsByDefault={showMenu}
        onClick={canOpen ? (event) => {
          onOpen(event.ctrlKey || event.metaKey);
        } : undefined}
        onContextMenu={handleContextMenu}
        contentClassName="z-30"
        main={
          <div className="relative min-w-0 pr-5">
            <span className={getSidebarLabelClass('notes', { selected: isActive })}>
              {title}
            </span>
            <SidebarStarBadge
              onClick={() => {
                onRemove();
              }}
            />
          </div>
        }
      />

      <NotesSidebarContextMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
      >
        <NotesSidebarContextMenuContent entries={menuEntries} />
      </NotesSidebarContextMenu>
    </>
  );
}
