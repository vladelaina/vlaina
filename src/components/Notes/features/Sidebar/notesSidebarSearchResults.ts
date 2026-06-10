import type { StarredEntry } from '@/stores/notes/types';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import { getNotesSidebarContentMatches } from './notesSidebarContentSearch';
import { collectStarredSearchEntries } from './notesSidebarStarredSearchEntries';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { normalizeVaultRelativePath } from '@/stores/notes/utils/fs/vaultPathContainment';

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
export const NOTES_SIDEBAR_MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_INDEX_TREE_ENTRIES = 10_000;

interface NotesSidebarSearchEntryMetadata {
  lowerName: string;
  lowerNameStartOffsets: number[];
  lowerPreview: string;
  lowerPreviewStartOffsets: number[];
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
  const normalizedName = normalizeSearchTextWithOffsets(entry.name);
  const normalizedPreview = normalizeSearchTextWithOffsets(entry.preview);
  Object.defineProperty(entry, SEARCH_ENTRY_METADATA, {
    configurable: true,
    enumerable: false,
    value: {
      lowerName: normalizedName.text,
      lowerNameStartOffsets: normalizedName.startOffsets,
      lowerPreview: normalizedPreview.text,
      lowerPreviewStartOffsets: normalizedPreview.startOffsets,
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

  const normalizedName = normalizeSearchTextWithOffsets(entry.name);
  const normalizedPreview = normalizeSearchTextWithOffsets(entry.preview);
  return {
    lowerName: normalizedName.text,
    lowerNameStartOffsets: normalizedName.startOffsets,
    lowerPreview: normalizedPreview.text,
    lowerPreviewStartOffsets: normalizedPreview.startOffsets,
  };
}

function normalizeSearchTextWithOffsets(value: string): {
  text: string;
  startOffsets: number[];
} {
  let text = '';
  const startOffsets: number[] = [];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
    }

    text += normalized;
    index += sourceLength;
  }

  startOffsets[text.length] = value.length;

  return { text, startOffsets };
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
) {
  const bucket: NotesSidebarSearchEntry[] = [];
  const stack = children
    .slice()
    .reverse()
    .map((node) => ({ node, parentPath: '' }));

  while (stack.length > 0 && bucket.length < MAX_SEARCH_INDEX_TREE_ENTRIES) {
    const { node, parentPath } = stack.pop()!;
    if (node.isFolder) {
      const normalizedFolderPath = normalizeVaultRelativePath(node.path, { allowEmpty: true });
      if (normalizedFolderPath === null || hasInternalNotePathSegment(normalizedFolderPath)) {
        continue;
      }

      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: node.children[index], parentPath: normalizedFolderPath });
      }
      continue;
    }

    const normalizedPath = normalizeVaultRelativePath(node.path);
    if (
      normalizedPath &&
      !hasInternalNotePathSegment(normalizedPath) &&
      isSupportedMarkdownPath(normalizedPath)
    ) {
      bucket.push(attachSearchEntryMetadata({
        path: normalizedPath,
        name: getDisplayName(normalizedPath) || node.name,
        preview: parentPath ? `${parentPath}/` : '',
      }));
    }
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
  structuralResults = queryNotesSidebarStructuralSearch(index, query),
): NotesSidebarSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLocaleLowerCase();
  const includeContentMatches = shouldSearchNotesSidebarContents(trimmedQuery);
  if (
    !includeContentMatches ||
    !getNoteContent ||
    structuralResults.length >= NOTES_SIDEBAR_MAX_SEARCH_RESULTS
  ) {
    return structuralResults.slice(0, NOTES_SIDEBAR_MAX_SEARCH_RESULTS);
  }

  const contentResults: NotesSidebarSearchResult[] = [];
  const contentResultLimit = NOTES_SIDEBAR_MAX_SEARCH_RESULTS - structuralResults.length;
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
  return [...structuralResults, ...contentResults].slice(0, NOTES_SIDEBAR_MAX_SEARCH_RESULTS);
}

export function queryNotesSidebarStructuralSearch(
  index: NotesSidebarSearchEntry[],
  query: string,
): NotesSidebarSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLocaleLowerCase();
  const structuralResults: NotesSidebarSearchResult[] = [];

  for (const entry of index) {
    const {
      lowerName,
      lowerNameStartOffsets,
      lowerPreview,
      lowerPreviewStartOffsets,
    } = getSearchEntryMetadata(entry);
    const nameMatchIndex = lowerName.indexOf(lowerQuery);
    const pathMatchIndex = lowerPreview.indexOf(lowerQuery);

    if (nameMatchIndex !== -1) {
      structuralResults.push({
        ...entry,
        id: `${entry.path}::name`,
        matchIndex: lowerNameStartOffsets[nameMatchIndex] ?? nameMatchIndex,
        matchKind: 'name',
        contentSnippet: null,
        contentMatchOrdinal: null,
      });
    }

    if (pathMatchIndex !== -1) {
      structuralResults.push({
        ...entry,
        id: `${entry.path}::path`,
        matchIndex: lowerPreviewStartOffsets[pathMatchIndex] ?? pathMatchIndex,
        matchKind: 'path',
        contentSnippet: null,
        contentMatchOrdinal: null,
      });
    }
  }

  structuralResults.sort(compareSearchResults);
  return structuralResults.slice(0, NOTES_SIDEBAR_MAX_SEARCH_RESULTS);
}
