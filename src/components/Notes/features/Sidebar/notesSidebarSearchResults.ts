import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredVaultPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';

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
const CONTENT_SNIPPET_RADIUS = 36;
const MAX_CONTENT_MATCHES_PER_NOTE = 5;
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

function getParentPreview(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalizedPath.split('/').filter(Boolean);
  parts.pop();

  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

function collectStarredSearchEntries(
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
    entries.push(attachSearchEntryMetadata({
      path: entryPath,
      openPath: entryPath,
      name: getNoteTitleFromPath(entry.relativePath),
      preview: getParentPreview(entryPath),
      isExternal: !isCurrentVaultEntry,
      contentSearchable: false,
    }));
  }

  return entries;
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
    ),
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

function normalizeContentForSearch(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(line: string): string {
  return line.replace(/<[^>]*>/g, ' ');
}

function isHtmlNoiseLine(line: string): boolean {
  const lowerLine = line.toLowerCase();

  if (/<\/?[a-z][^>]*>/.test(lowerLine)) {
    return true;
  }

  return /(frameborder|allowfullscreen|default-tab=|embed-version=|theme-id=|referrerpolicy=|loading=|sandbox=|src=|href=|style=|class=|width=|height=)/.test(lowerLine);
}

function toPlainTextLine(line: string): string {
  if (isHtmlNoiseLine(line)) {
    return '';
  }

  return stripHtmlTags(line)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^\s*>\s*/g, '')
    .replace(/^\s*#{1,6}\s+/g, '')
    .replace(/^\s*[-*+]\s+\[(?: |x|X)\]\s+/g, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function* iterateLines(content: string): Iterable<string> {
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    const charCode = content.charCodeAt(index);
    if (charCode !== 10 && charCode !== 13) {
      continue;
    }

    yield content.slice(start, index);

    if (charCode === 13 && content.charCodeAt(index + 1) === 10) {
      index += 1;
    }
    start = index + 1;
  }

  yield content.slice(start);
}

function getContentMatches(content: string | undefined, lowerQuery: string) {
  if (!content) {
    return [];
  }

  const matches: Array<{
    matchIndex: number;
    snippet: string;
    ordinal: number;
  }> = [];
  let ordinal = 0;
  for (const rawLine of iterateLines(content)) {
    const plainLine = toPlainTextLine(rawLine);
    if (!plainLine) {
      continue;
    }

    const normalizedContent = normalizeContentForSearch(plainLine);
    if (!normalizedContent) {
      continue;
    }

    const lowerContent = normalizedContent.toLowerCase();
    let searchFrom = 0;

    while (searchFrom <= lowerContent.length - lowerQuery.length) {
      const matchIndex = lowerContent.indexOf(lowerQuery, searchFrom);
      if (matchIndex === -1) {
        break;
      }

      const start = Math.max(0, matchIndex - CONTENT_SNIPPET_RADIUS);
      const end = Math.min(
        normalizedContent.length,
        matchIndex + lowerQuery.length + CONTENT_SNIPPET_RADIUS,
      );
      const snippet = normalizedContent.slice(start, end).trim();

      matches.push({
        matchIndex,
        snippet: `${start > 0 ? '…' : ''}${snippet}${end < normalizedContent.length ? '…' : ''}`,
        ordinal,
      });

      ordinal += 1;
      if (matches.length >= MAX_CONTENT_MATCHES_PER_NOTE) {
        return matches;
      }
      searchFrom = matchIndex + Math.max(lowerQuery.length, 1);
    }
  }

  return matches;
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

    const contentMatches = getContentMatches(getNoteContent(entry.path), lowerQuery);
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
