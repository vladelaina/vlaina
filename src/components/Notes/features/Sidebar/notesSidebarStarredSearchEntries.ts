import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredVaultPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import type { NotesSidebarSearchEntry } from './notesSidebarSearchResults';

function getParentPreview(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalizedPath.split('/').filter(Boolean);
  parts.pop();

  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

export function collectStarredSearchEntries(
  starredEntries: StarredEntry[],
  currentVaultPath: string | null | undefined,
  existingTreePaths: Set<string>,
): NotesSidebarSearchEntry[] {
  const normalizedCurrentVaultPath = currentVaultPath
    ? normalizeStarredVaultPath(currentVaultPath)
    : '';
  const entries: NotesSidebarSearchEntry[] = [];
  const seenOpenPaths = new Set<string>();

  for (const entry of starredEntries) {
    if (entry.kind !== 'note') {
      continue;
    }
    if (!isSupportedMarkdownPath(entry.relativePath)) {
      continue;
    }

    const isCurrentVaultEntry =
      normalizedCurrentVaultPath !== '' &&
      normalizeStarredVaultPath(entry.vaultPath) === normalizedCurrentVaultPath;
    if (isCurrentVaultEntry && existingTreePaths.has(entry.relativePath)) {
      continue;
    }

    const entryPath = isCurrentVaultEntry
      ? entry.relativePath
      : getStarredEntryAbsolutePath(entry);
    if (!entryPath || seenOpenPaths.has(entryPath)) {
      continue;
    }

    seenOpenPaths.add(entryPath);
    entries.push({
      path: entryPath,
      openPath: entryPath,
      name: getNoteTitleFromPath(entry.relativePath),
      preview: getParentPreview(entryPath),
      isExternal: !isCurrentVaultEntry,
      contentSearchable: false,
    });
  }

  return entries;
}
