import { useRef, useState, type MouseEvent } from 'react';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { Icon } from '@/components/ui/icons';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { cn, iconButtonStyles } from '@/lib/utils';
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
import { getSidebarMenuPositionFromTriggerRect } from '../common/sidebarMenuPosition';
import { getEntryTitle } from './starredSectionUtils';

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const liveTitle = useDisplayName(
    isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined,
  );
  const liveIcon = useDisplayIcon(
    isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined,
  );
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const title = liveTitle || getEntryTitle(entry);
  const canOpen = entry.kind === 'note';

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
            liveIcon ? (
              <NoteIcon icon={liveIcon} notePath={entry.relativePath} size={16} />
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
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={`Open ${title} menu`}
            onClick={(event) => {
              event.stopPropagation();
              if (!menuButtonRef.current) return;
              setMenuPosition(
                getSidebarMenuPositionFromTriggerRect(menuButtonRef.current.getBoundingClientRect()),
              );
              setShowMenu((prev) => !prev);
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              showMenu || isActive
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]',
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
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
