import { useEffect, useState, type MouseEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { StarredEntry } from '@/stores/notes/types';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { cn, iconButtonStyles } from '@/lib/utils';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { NotesSidebarSection } from '../Sidebar/NotesSidebarPrimitives';

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

interface StarredEntryRowProps {
  entry: StarredEntry;
  isCurrentVaultEntry: boolean;
  isActive: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

function StarredEntryRow({
  entry,
  isCurrentVaultEntry,
  isActive,
  onClick,
  onRemove,
}: StarredEntryRowProps) {
  const liveTitle = useDisplayName(isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined);
  const liveIcon = useDisplayIcon(isCurrentVaultEntry && entry.kind === 'note' ? entry.relativePath : undefined);
  const title =
    entry.kind === 'note'
      ? liveTitle || getNoteTitleFromPath(entry.relativePath)
      : getFolderName(entry.relativePath);

  return (
    <NotesSidebarRow
      leading={
        entry.kind === 'note' ? (
          liveIcon ? (
            <NoteIcon icon={liveIcon} size="sidebar" />
          ) : (
            <Icon
              name="file.text"
              size="sidebar"
              className="text-[var(--notes-sidebar-file-icon)]"
            />
          )
        ) : (
          <Icon
            name="file.folder"
            size="sidebar"
            className="text-[var(--notes-sidebar-folder-icon)]"
          />
        )
      }
      isActive={isActive}
      onClick={onClick}
      main={
        <span
          className={cn(
            'block truncate',
            isActive && 'font-medium text-[var(--notes-sidebar-text)]'
          )}
        >
          {title}
        </span>
      }
      actions={
        <button
          type="button"
          aria-label={`Remove ${title} from starred`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            'rounded-md p-1 focus:outline-none',
            iconButtonStyles,
            'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
          )}
        >
          <Icon name="misc.star" size="md" className="fill-amber-500 text-amber-500" />
        </button>
      }
    />
  );
}

export function StarredSection() {
  const {
    starredEntries,
    starredLoaded,
    currentNote,
    openNote,
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

  if (!starredLoaded || starredEntries.length === 0) {
    return null;
  }

  const currentVaultPath = currentVault?.path ? normalizeStarredVaultPath(currentVault.path) : '';

  return (
    <NotesSidebarSection
      title="Starred"
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      animated={false}
    >
      <div>
        {starredEntries.map((entry) => {
          const vaultLabel = getVaultLabel(entry.vaultPath, recentVaults);
          const isCurrentVaultEntry =
            normalizeStarredVaultPath(entry.vaultPath) === currentVaultPath;
          const isActive =
            entry.kind === 'note' &&
            isCurrentVaultEntry &&
            currentNote?.path === entry.relativePath;

          return (
            <StarredEntryRow
              key={entry.id}
              entry={entry}
              isCurrentVaultEntry={isCurrentVaultEntry}
              isActive={isActive}
              onClick={(event) => {
                const openInNewTab =
                  entry.kind === 'note' && (event.ctrlKey || event.metaKey);
                void (async () => {
                  if (isCurrentVaultEntry) {
                    if (entry.kind === 'folder') {
                      revealFolder(entry.relativePath);
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
              }}
              onRemove={() => removeStarredEntry(entry.id)}
            />
          );
        })}
      </div>
    </NotesSidebarSection>
  );
}
