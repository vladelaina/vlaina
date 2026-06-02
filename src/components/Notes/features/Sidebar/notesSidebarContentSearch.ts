import { stripMarkdownInline } from '@/components/common/markdown/plainText';

const CONTENT_SNIPPET_RADIUS = 36;
const MAX_CONTENT_MATCHES_PER_NOTE = 5;

export interface NotesSidebarContentMatch {
  matchIndex: number;
  snippet: string;
  ordinal: number;
}

function normalizeContentForSearch(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
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

  return stripMarkdownInline(line, { preserveImageAlt: false })
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^\s*>\s*/g, '')
    .replace(/^\s*#{1,6}\s+/g, '')
    .replace(/^\s*[-*+]\s+\[(?: |x|X)\]\s+/g, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/g, '')
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

export function getNotesSidebarContentMatches(
  content: string | undefined,
  lowerQuery: string,
): NotesSidebarContentMatch[] {
  if (!content) {
    return [];
  }

  const matches: NotesSidebarContentMatch[] = [];
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
