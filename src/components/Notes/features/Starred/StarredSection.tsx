import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { FileTreeNode, FolderNode, StarredEntry } from '@/stores/notes/types';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { cn, iconButtonStyles } from '@/lib/utils';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { FileItem } from '../FileTree/FileItem';
import { FolderItem } from '../FileTree/FolderItem';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NotesSidebarSection } from '../Sidebar/NotesSidebarPrimitives';
import { NotesSidebarContextMenu } from '../Sidebar/NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from '../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { NOTES_SIDEBAR_ICON_SIZE } from '../Sidebar/sidebarLayout';
import { SidebarStarBadge } from '../common/SidebarStarBadge';
import { getSidebarMenuPositionFromTriggerRect } from '../common/sidebarMenuPosition';

function getVaultLabel(path: string, recentVaults: Array<{ path: string; name: string }>): string {
  const normalizedPath = normalizeStarredVaultPath(path);
  const matchedVault = recentVaults.find(
    (vault) => normalizeStarredVaultPath(vault.path) === normalizedPath
  );
  if (matchedVault) return matchedVault.name;

  const parts = normalizedPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Vault';
}

function getFolderName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

function getEntryTitle(entry: StarredEntry): string {
  return entry.kind === 'note'
    ? getNoteTitleFromPath(entry.relativePath)
    : getFolderName(entry.relativePath);
}

function isAncestorStarredPath(ancestorPath: string, descendantPath: string) {
  return descendantPath.startsWith(`${ancestorPath}/`);
}

function sortStarredEntries(entries: StarredEntry[]) {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.vaultPath === right.entry.vaultPath) {
        if (isAncestorStarredPath(left.entry.relativePath, right.entry.relativePath)) {
          return 1;
        }
        if (isAncestorStarredPath(right.entry.relativePath, left.entry.relativePath)) {
          return -1;
        }
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function collectNodeLookup(nodes: FileTreeNode[], lookup: Map<string, FileTreeNode>) {
  for (const node of nodes) {
    lookup.set(node.path, node);
    if (node.isFolder) {
      collectNodeLookup(node.children, lookup);
    }
  }
}

function buildNodeLookup(rootFolder: FolderNode | null) {
  const lookup = new Map<string, FileTreeNode>();
  if (!rootFolder) {
    return lookup;
  }

  collectNodeLookup(rootFolder.children, lookup);
  return lookup;
}

interface ExternalStarredEntryRowProps {
  entry: StarredEntry;
  isCurrentVaultEntry: boolean;
  isActive: boolean;
  onOpen: (openInNewTab?: boolean) => void;
  onRemove: () => void;
}

function ExternalStarredEntryRow({
  entry,
  isCurrentVaultEntry,
  isActive,
  onOpen,
  onRemove,
}: ExternalStarredEntryRowProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const liveTitle = useDisplayName(isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined);
  const liveIcon = useDisplayIcon(isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const title = liveTitle || getEntryTitle(entry);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ top: event.clientY, left: event.clientX });
    setShowMenu(true);
  };

  return (
    <>
      <NotesSidebarRow
        leading={
          entry.kind === 'note' ? (
            liveIcon ? (
              <NoteIcon icon={liveIcon} notePath={entry.relativePath} size={NOTES_SIDEBAR_ICON_SIZE} />
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
              size={NOTES_SIDEBAR_ICON_SIZE}
              className="text-[var(--notes-sidebar-folder-icon)]"
            />
          )
        }
        isActive={isActive}
        isHighlighted={showMenu}
        showActionsByDefault={showMenu}
        onClick={(event) => onOpen(entry.kind === 'note' && (event.ctrlKey || event.metaKey))}
        onContextMenu={handleContextMenu}
        main={
          <div className="relative min-w-0 pr-5">
            <span
              className={cn(
                'block truncate',
                isActive && 'font-medium text-[var(--notes-sidebar-text)]'
              )}
            >
              {title}
            </span>
            <SidebarStarBadge onClick={onRemove} />
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
              setMenuPosition(getSidebarMenuPositionFromTriggerRect(menuButtonRef.current.getBoundingClientRect()));
              setShowMenu((prev) => !prev);
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

      <NotesSidebarContextMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
      >
        <NotesSidebarContextMenuContent
          entries={[
            ...(entry.kind === 'note'
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
          ]}
        />
      </NotesSidebarContextMenu>
    </>
  );
}

interface StarredSectionProps {
  nested?: boolean;
  showTitle?: boolean;
}

export function StarredSection({
  nested = false,
  showTitle = true,
}: StarredSectionProps = {}) {
  const {
    starredEntries,
    starredLoaded,
    currentNote,
    rootFolder,
    openNote,
    toggleFolder,
    revealFolder,
    removeStarredEntry,
    setPendingStarredNavigation,
  } = useNotesStore();
  const { currentVault, recentVaults, openVault } = useVaultStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (starredLoaded && starredEntries.length > 0) {
      setExpanded(true);
    }
  }, [starredLoaded, starredEntries.length]);

  const currentVaultPath = currentVault?.path ? normalizeStarredVaultPath(currentVault.path) : '';
  const sortedStarredEntries = useMemo(() => sortStarredEntries(starredEntries), [starredEntries]);
  const nodeLookup = useMemo(() => buildNodeLookup(rootFolder), [rootFolder]);

  if (!starredLoaded || starredEntries.length === 0) {
    return null;
  }

  const entries = (
    <div>
      {sortedStarredEntries.map((entry) => {
        const isCurrentVaultEntry =
          normalizeStarredVaultPath(entry.vaultPath) === currentVaultPath;
        const treeNode = isCurrentVaultEntry
          ? nodeLookup.get(entry.relativePath) ?? null
          : null;
        const vaultLabel = getVaultLabel(entry.vaultPath, recentVaults);
        const isActive =
          entry.kind === 'note' &&
          isCurrentVaultEntry &&
          currentNote?.path === entry.relativePath;

        const handleOpen = (openInNewTab = false) => {
          void (async () => {
            if (isCurrentVaultEntry) {
              if (entry.kind === 'folder') {
                if (treeNode?.isFolder) {
                  toggleFolder(treeNode.path);
                } else {
                  revealFolder(entry.relativePath);
                }
              } else {
                await openNote(entry.relativePath, openInNewTab);
              }
              return;
            }

            setPendingStarredNavigation({
              vaultPath: entry.vaultPath,
              kind: entry.kind,
              relativePath: entry.relativePath,
              openInNewTab,
            });

            const opened = await openVault(entry.vaultPath, vaultLabel);
            if (!opened) {
              setPendingStarredNavigation(null);
            }
          })();
        };

        if (isCurrentVaultEntry && treeNode) {
          return treeNode.isFolder ? (
            <FolderItem
              key={entry.id}
              node={treeNode}
              depth={0}
              showStarBadge
              dragEnabled={false}
            />
          ) : (
            <FileItem
              key={entry.id}
              node={treeNode}
              depth={0}
              showStarBadge
              dragEnabled={false}
            />
          );
        }

        return (
          <ExternalStarredEntryRow
            key={entry.id}
            entry={entry}
            isCurrentVaultEntry={isCurrentVaultEntry}
            isActive={isActive}
            onOpen={handleOpen}
            onRemove={() => removeStarredEntry(entry.id)}
          />
        );
      })}
    </div>
  );

  if (!showTitle) {
    return entries;
  }

  return (
    <NotesSidebarSection
      title="Starred"
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      animated={false}
      nested={nested}
      headerClassName={nested ? 'px-2' : undefined}
    >
      {entries}
    </NotesSidebarSection>
  );
}
