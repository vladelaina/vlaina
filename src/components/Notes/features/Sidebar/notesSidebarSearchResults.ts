import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';

export interface NotesSidebarSearchEntry {
  path: string;
  name: string;
  preview: string;
}

export interface NotesSidebarSearchResult extends NotesSidebarSearchEntry {
  matchIndex: number;
}

function collectNotesSidebarSearchEntries(
  children: FileTreeNode[],
  getDisplayName: (path: string) => string,
  parentPath = '',
  bucket: NotesSidebarSearchEntry[] = [],
) {
  for (const node of children) {
    if (node.isFolder) {
      collectNotesSidebarSearchEntries(node.children, getDisplayName, node.path, bucket);
      continue;
    }

    bucket.push({
      path: node.path,
      name: getDisplayName(node.path) || node.name,
      preview: parentPath ? `${parentPath}/` : '',
    });
  }

  return bucket;
}

export function buildNotesSidebarSearchIndex(
  rootFolder: FolderNode | null,
  getDisplayName: (path: string) => string,
): NotesSidebarSearchEntry[] {
  if (!rootFolder) {
    return [];
  }

  return collectNotesSidebarSearchEntries(rootFolder.children, getDisplayName);
}

export function queryNotesSidebarSearch(
  index: NotesSidebarSearchEntry[],
  query: string,
): NotesSidebarSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLowerCase();

  return index
    .map((entry) => ({
      ...entry,
      matchIndex: entry.name.toLowerCase().indexOf(lowerQuery),
    }))
    .filter((entry) => entry.matchIndex !== -1)
    .sort((a, b) => a.matchIndex - b.matchIndex || a.name.localeCompare(b.name))
    .slice(0, 12);
}
