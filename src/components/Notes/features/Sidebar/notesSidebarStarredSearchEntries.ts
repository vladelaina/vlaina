import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
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
    const relativePath = normalizeStarredRelativePath(entry.relativePath);
    if (!relativePath || !isSupportedMarkdownPath(relativePath)) {
      continue;
    }

    const isCurrentVaultEntry =
      normalizedCurrentVaultPath !== '' &&
      normalizeStarredVaultPath(entry.vaultPath) === normalizedCurrentVaultPath;
    if (isCurrentVaultEntry && existingTreePaths.has(relativePath)) {
      continue;
    }

    const entryPath = isCurrentVaultEntry
      ? relativePath
      : getStarredEntryAbsolutePath({ ...entry, relativePath });
    if (!entryPath || seenOpenPaths.has(entryPath)) {
      continue;
    }

    seenOpenPaths.add(entryPath);
    entries.push({
      path: entryPath,
      openPath: entryPath,
      name: getNoteTitleFromPath(relativePath),
      preview: getParentPreview(entryPath),
      isExternal: !isCurrentVaultEntry,
      contentSearchable: false,
    });
  }

  return entries;
}
