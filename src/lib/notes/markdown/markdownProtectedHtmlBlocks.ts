import {
  getMarkdownBlockContent,
  getMarkdownHtmlBlockClosePattern,
} from '@/lib/markdown/markdownHtmlBlockClassification';
import { getHtmlTagRanges } from '@/lib/markdown/markdownHtmlRanges';

const HTML_RAW_BLOCK_OPEN_PATTERN = /^(?: {0,3})<(pre|script|style|textarea|title|xmp|noembed|noframes|plaintext|math|noscript|svg)(?:\s|>|$)/i;
const NEVER_CLOSE_HTML_BLOCK_PATTERN = /$a/;

export type HtmlBlockState = { closePattern: RegExp; rawTagName?: string };

export function nextHtmlBlockState(line: string, activeHtmlBlock: HtmlBlockState | null): HtmlBlockState | null {
  const content = getMarkdownBlockContent(line);
  const closePattern = activeHtmlBlock ?? getMarkdownRawHtmlBlockClosePattern(content);
  if (!closePattern) return null;
  return isHtmlBlockCloseLine(content, closePattern) ? null : closePattern;
}

export function getMarkdownRawHtmlBlockClosePattern(
  line: string,
  options: { protectHtmlComments?: boolean } = {},
): HtmlBlockState | null {
  const rawBlockMatch = HTML_RAW_BLOCK_OPEN_PATTERN.exec(line);
  if (rawBlockMatch) {
    const rawTagName = rawBlockMatch[1]?.toLowerCase() ?? '';
    if (rawTagName === 'plaintext') {
      return { closePattern: NEVER_CLOSE_HTML_BLOCK_PATTERN, rawTagName };
    }
    return {
      closePattern: new RegExp(`</${rawTagName}(?:\\s[^>]*)?>`, 'i'),
      rawTagName,
    };
  }
  const closePattern = getMarkdownHtmlBlockClosePattern(line, options);
  return closePattern === undefined ? null : { closePattern: closePattern ?? /^\s*$/ };
}

export function isHtmlBlockCloseLine(line: string, state: HtmlBlockState): boolean {
  if (state.closePattern === NEVER_CLOSE_HTML_BLOCK_PATTERN) {
    return false;
  }

  if (!state.rawTagName) {
    return state.closePattern.test(line);
  }

  return getHtmlTagRanges(line, { start: 0, end: line.length }, 1024)
    .some((range) => {
      const tagNameMatch = /^<\/([A-Za-z][A-Za-z0-9:-]*)\b/i.exec(line.slice(range.start, range.end));
      return tagNameMatch?.[1]?.toLowerCase() === state.rawTagName;
    });
}
