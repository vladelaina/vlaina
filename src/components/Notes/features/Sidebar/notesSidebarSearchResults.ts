import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';

export interface NotesSidebarSearchEntry {
  path: string;
  name: string;
  preview: string;
}

export interface NotesSidebarSearchResult extends NotesSidebarSearchEntry {
  id: string;
  matchIndex: number;
  matchKind: 'name' | 'content';
  contentSnippet: string | null;
  contentMatchOrdinal: number | null;
}

const CONTENT_SEARCH_MIN_QUERY_LENGTH = 2;
const CONTENT_SNIPPET_RADIUS = 36;
const MAX_CONTENT_MATCHES_PER_NOTE = 5;
const MAX_SEARCH_RESULTS = 200;

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
  const lines = content
    .split(/\r?\n/)
    .map((line) => toPlainTextLine(line))
    .filter(Boolean);

  for (const line of lines) {
    const normalizedContent = normalizeContentForSearch(line);
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

  return index
    .flatMap((entry) => {
      const matchIndex = entry.name.toLowerCase().indexOf(lowerQuery);
      const contentMatches = includeContentMatches
        ? getContentMatches(getNoteContent?.(entry.path), lowerQuery)
        : [];
      const results: NotesSidebarSearchResult[] = [];

      if (matchIndex !== -1) {
        results.push({
          ...entry,
          id: `${entry.path}::name`,
          matchIndex,
          matchKind: 'name',
          contentSnippet: null,
          contentMatchOrdinal: contentMatches[0]?.ordinal ?? null,
        });
      }

      for (const contentMatch of contentMatches) {
        results.push({
          ...entry,
          id: `${entry.path}::content::${contentMatch.ordinal}`,
          matchIndex: contentMatch.matchIndex,
          matchKind: 'content',
          contentSnippet: contentMatch.snippet,
          contentMatchOrdinal: contentMatch.ordinal,
        });
      }

      return results;
    })
    .sort((a, b) => {
      if (a.matchKind !== b.matchKind) {
        return a.matchKind === 'name' ? -1 : 1;
      }

      if (a.path !== b.path) {
        return a.path.localeCompare(b.path);
      }

      return (
        a.matchIndex - b.matchIndex ||
        (a.contentMatchOrdinal ?? -1) - (b.contentMatchOrdinal ?? -1) ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, MAX_SEARCH_RESULTS);
}
