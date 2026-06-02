import type { StarredEntry } from '@/stores/notes/types';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import { getNotesSidebarContentMatches } from './notesSidebarContentSearch';
import { collectStarredSearchEntries } from './notesSidebarStarredSearchEntries';

export interface NotesSidebarSearchEntry {
  path: string;
  openPath?: string;
  name: string;
  preview: string;
  isExternal?: boolean;
  contentSearchable?: boolean;
}

export interface NotesSidebarSearchResult extends NotesSidebarSearchEntry {
  id: string;
  matchIndex: number;
  matchKind: 'name' | 'path' | 'content';
  contentSnippet: string | null;
  contentMatchOrdinal: number | null;
}

export interface NotesSidebarSearchIndexOptions {
  starredEntries?: StarredEntry[];
  currentVaultPath?: string | null;
}

const SEARCH_ENTRY_METADATA = Symbol('notesSidebarSearchEntryMetadata');
const SEARCH_INDEX_METADATA = Symbol('notesSidebarSearchIndexMetadata');
const CONTENT_SEARCH_MIN_QUERY_LENGTH = 2;
const MAX_SEARCH_RESULTS = 200;

interface NotesSidebarSearchEntryMetadata {
  lowerName: string;
  lowerPreview: string;
}

interface NotesSidebarSearchIndexMetadata {
  contentEntriesByPath: NotesSidebarSearchEntry[];
}

type MetadataSearchEntry = NotesSidebarSearchEntry & {
  [SEARCH_ENTRY_METADATA]?: NotesSidebarSearchEntryMetadata;
};

type MetadataSearchIndex = NotesSidebarSearchEntry[] & {
  [SEARCH_INDEX_METADATA]?: NotesSidebarSearchIndexMetadata;
};

function attachSearchEntryMetadata(entry: NotesSidebarSearchEntry): NotesSidebarSearchEntry {
  Object.defineProperty(entry, SEARCH_ENTRY_METADATA, {
    configurable: true,
    enumerable: false,
    value: {
      lowerName: entry.name.toLowerCase(),
      lowerPreview: entry.preview.toLowerCase(),
    } satisfies NotesSidebarSearchEntryMetadata,
  });

  return entry;
}

function attachSearchIndexMetadata(index: NotesSidebarSearchEntry[]): NotesSidebarSearchEntry[] {
  const contentEntriesByPath = index
    .filter((entry) => entry.contentSearchable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));

  Object.defineProperty(index, SEARCH_INDEX_METADATA, {
    configurable: true,
    enumerable: false,
    value: {
      contentEntriesByPath,
    } satisfies NotesSidebarSearchIndexMetadata,
  });

  return index;
}

function getSearchEntryMetadata(entry: NotesSidebarSearchEntry): NotesSidebarSearchEntryMetadata {
  const metadata = (entry as MetadataSearchEntry)[SEARCH_ENTRY_METADATA];
  if (metadata) {
    return metadata;
  }

  return {
    lowerName: entry.name.toLowerCase(),
    lowerPreview: entry.preview.toLowerCase(),
  };
}

function getContentSearchEntriesByPath(index: NotesSidebarSearchEntry[]): NotesSidebarSearchEntry[] {
  const metadata = (index as MetadataSearchIndex)[SEARCH_INDEX_METADATA];
  if (metadata) {
    return metadata.contentEntriesByPath;
  }

  return index
    .filter((entry) => entry.contentSearchable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));
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

    bucket.push(attachSearchEntryMetadata({
      path: node.path,
      name: getDisplayName(node.path) || node.name,
      preview: parentPath ? `${parentPath}/` : '',
    }));
  }

  return bucket;
}

export function buildNotesSidebarSearchIndex(
  rootFolder: FolderNode | null,
  getDisplayName: (path: string) => string,
  options: NotesSidebarSearchIndexOptions = {},
): NotesSidebarSearchEntry[] {
  const treeEntries = rootFolder
    ? collectNotesSidebarSearchEntries(rootFolder.children, getDisplayName)
    : [];

  if (!options.starredEntries?.length) {
    return attachSearchIndexMetadata(treeEntries);
  }

  return attachSearchIndexMetadata([
    ...treeEntries,
    ...collectStarredSearchEntries(
      options.starredEntries,
      options.currentVaultPath,
      new Set(treeEntries.map((entry) => entry.path)),
    ).map(attachSearchEntryMetadata),
  ]);
}

export function countNotesSidebarSearchEntries(rootFolder: FolderNode | null): number {
  if (!rootFolder) {
    return 0;
  }

  return collectNotesSidebarSearchEntries(rootFolder.children, () => '').length;
}

export function shouldSearchNotesSidebarContents(query: string): boolean {
  return query.trim().length >= CONTENT_SEARCH_MIN_QUERY_LENGTH;
}

function compareSearchResults(a: NotesSidebarSearchResult, b: NotesSidebarSearchResult): number {
  if (a.matchKind !== b.matchKind) {
    const rank = { name: 0, path: 1, content: 2 };
    return rank[a.matchKind] - rank[b.matchKind];
  }

  if (a.path !== b.path) {
    return a.path.localeCompare(b.path);
  }

  return (
    a.matchIndex - b.matchIndex ||
    (a.contentMatchOrdinal ?? -1) - (b.contentMatchOrdinal ?? -1) ||
    a.name.localeCompare(b.name)
  );
}

export function queryNotesSidebarSearch(
  index: NotesSidebarSearchEntry[],
  query: string,
  getNoteContent?: (path: string) => string | undefined,
): NotesSidebarSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLowerCase();
  const includeContentMatches = shouldSearchNotesSidebarContents(trimmedQuery);
  const structuralResults: NotesSidebarSearchResult[] = [];

  for (const entry of index) {
    const { lowerName, lowerPreview } = getSearchEntryMetadata(entry);
    const nameMatchIndex = lowerName.indexOf(lowerQuery);
    const pathMatchIndex = lowerPreview.indexOf(lowerQuery);

    if (nameMatchIndex !== -1) {
      structuralResults.push({
        ...entry,
        id: `${entry.path}::name`,
        matchIndex: nameMatchIndex,
        matchKind: 'name',
        contentSnippet: null,
        contentMatchOrdinal: null,
      });
    }

    if (pathMatchIndex !== -1) {
      structuralResults.push({
        ...entry,
        id: `${entry.path}::path`,
        matchIndex: pathMatchIndex,
        matchKind: 'path',
        contentSnippet: null,
        contentMatchOrdinal: null,
      });
    }
  }

  structuralResults.sort(compareSearchResults);
  if (!includeContentMatches || !getNoteContent || structuralResults.length >= MAX_SEARCH_RESULTS) {
    return structuralResults.slice(0, MAX_SEARCH_RESULTS);
  }

  const contentResults: NotesSidebarSearchResult[] = [];
  const contentResultLimit = MAX_SEARCH_RESULTS - structuralResults.length;
  const contentEntries = getContentSearchEntriesByPath(index);

  for (const entry of contentEntries) {
    if (contentResults.length >= contentResultLimit) {
      break;
    }

    const contentMatches = getNotesSidebarContentMatches(getNoteContent(entry.path), lowerQuery);
    for (const contentMatch of contentMatches) {
      contentResults.push({
        ...entry,
        id: `${entry.path}::content::${contentMatch.ordinal}`,
        matchIndex: contentMatch.matchIndex,
        matchKind: 'content',
        contentSnippet: contentMatch.snippet,
        contentMatchOrdinal: contentMatch.ordinal,
      });

      if (contentResults.length >= contentResultLimit) {
        break;
      }
    }
  }

  contentResults.sort(compareSearchResults);
  return [...structuralResults, ...contentResults].slice(0, MAX_SEARCH_RESULTS);
}
