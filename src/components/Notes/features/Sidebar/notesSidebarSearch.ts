import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';

export interface NotesSidebarSearchResult {
  path: string;
  name: string;
  preview: string;
  matchIndex: number;
}

function collectIndexedNotes(
  children: FileTreeNode[],
  getDisplayName: (path: string) => string,
  parentPath = '',
  bucket: NotesSidebarSearchResult[] = [],
) {
  for (const node of children) {
    if (node.isFolder) {
      collectIndexedNotes(node.children, getDisplayName, node.path, bucket);
      continue;
    }

    bucket.push({
      path: node.path,
      name: getDisplayName(node.path) || node.name,
      preview: parentPath ? `${parentPath}/` : '',
      matchIndex: 0,
    });
  }

  return bucket;
}

export function buildNotesSidebarSearchResults(
  rootFolder: FolderNode | null,
  query: string,
  getDisplayName: (path: string) => string,
) {
  if (!rootFolder || !query.trim()) return [];

  const lowerQuery = query.trim().toLowerCase();

  return collectIndexedNotes(rootFolder.children, getDisplayName)
    .map((result) => ({
      ...result,
      matchIndex: result.name.toLowerCase().indexOf(lowerQuery),
    }))
    .filter((result) => result.matchIndex !== -1)
    .sort((a, b) => a.matchIndex - b.matchIndex || a.name.localeCompare(b.name))
    .slice(0, 12);
}

export function useNotesSidebarSearchState() {
  const isSearchOpen = useUIStore((state) => state.notesSidebarSearchOpen);
  const setSearchOpen = useUIStore((state) => state.setNotesSidebarSearchOpen);
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, [setSearchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, [setSearchOpen, setSearchQuery]);

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
  };
}
