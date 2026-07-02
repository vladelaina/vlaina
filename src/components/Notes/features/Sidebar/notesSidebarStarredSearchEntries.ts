import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
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
  currentNotesRootPath: string | null | undefined,
  existingTreePaths: Set<string>,
): NotesSidebarSearchEntry[] {
  const normalizedCurrentNotesRootPath = currentNotesRootPath
    ? normalizeStarredNotesRootPath(currentNotesRootPath)
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

    const isCurrentNotesRootEntry =
      normalizedCurrentNotesRootPath !== '' &&
      normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedCurrentNotesRootPath;
    if (isCurrentNotesRootEntry && existingTreePaths.has(relativePath)) {
      continue;
    }

    const entryPath = isCurrentNotesRootEntry
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
      isExternal: !isCurrentNotesRootEntry,
      contentSearchable: false,
    });
  }

  return entries;
}
