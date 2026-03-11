import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { cn, iconButtonStyles } from '@/lib/utils';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
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
    >
      <div>
        {starredEntries.map((entry) => {
          const vaultLabel = getVaultLabel(entry.vaultPath, recentVaults);
          const isCurrentVaultEntry =
            normalizeStarredVaultPath(entry.vaultPath) === currentVaultPath;
          const parentPath = entry.relativePath.includes('/')
            ? entry.relativePath.slice(0, entry.relativePath.lastIndexOf('/'))
            : '';
          const detail = [isCurrentVaultEntry ? null : vaultLabel, parentPath || null]
            .filter(Boolean)
            .join(' / ');
          const title =
            entry.kind === 'note'
              ? getNoteTitleFromPath(entry.relativePath)
              : getFolderName(entry.relativePath);
          const isActive =
            entry.kind === 'note' &&
            isCurrentVaultEntry &&
            currentNote?.path === entry.relativePath;

          return (
            <NotesSidebarRow
              key={entry.id}
              leading={
                <Icon
                  name={entry.kind === 'folder' ? 'file.folder' : 'file.text'}
                  size="md"
                  className={
                    entry.kind === 'folder'
                      ? 'text-[var(--notes-sidebar-folder-icon)]'
                      : 'text-[var(--notes-sidebar-file-icon)]'
                  }
                />
              }
              isActive={isActive}
              onClick={() => {
                void (async () => {
                  if (isCurrentVaultEntry) {
                    if (entry.kind === 'folder') {
                      revealFolder(entry.relativePath);
                    } else {
                      await openNote(entry.relativePath);
                    }
                    return;
                  }

                  setPendingStarredNavigation({
                    vaultPath: entry.vaultPath,
                    kind: entry.kind,
                    relativePath: entry.relativePath,
                  });

                  const opened = await openVault(entry.vaultPath, vaultLabel);
                  if (!opened) {
                    setPendingStarredNavigation(null);
                  }
                })();
              }}
              main={
                <div className="min-w-0">
                  <div
                    className={cn(
                      'truncate',
                      isActive && 'font-medium text-[var(--notes-sidebar-text)]'
                    )}
                  >
                    {title}
                  </div>
                  <div className="truncate text-[11px] text-[var(--notes-sidebar-text-soft)]">
                    {detail || vaultLabel}
                  </div>
                </div>
              }
              actions={
                <button
                  type="button"
                  aria-label={`Remove ${title} from starred`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeStarredEntry(entry.id);
                  }}
                  className={cn(
                    'rounded-md p-1 focus:outline-none',
                    iconButtonStyles,
                    'text-amber-500 hover:text-amber-600'
                  )}
                >
                  <Icon name="misc.star" size="md" className="fill-amber-500 text-current" />
                </button>
              }
            />
          );
        })}
      </div>
    </NotesSidebarSection>
  );
}
