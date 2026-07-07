import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { normalizeRenderableImageSrc } from '@/lib/markdown/renderableImagePolicy';

export const MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS = 4096;
export const MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS = 1024 * 1024;
export const MAX_REQUEST_HISTORY_IMAGE_TOTAL_LABEL_SCAN_CHARS = 4 * MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS;
export const MAX_REQUEST_HISTORY_IMAGE_TOKENS = 2000;
export const MAX_REQUEST_HISTORY_HTML_IMAGE_TAG_END_SCAN_CHARS = 64 * 1024;
export const MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS = 4000;
export const MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES = 4000;
export const HISTORY_IMAGE_SOURCE_HINT_PATTERN = /\b(?:https?|data|attachment|app-file|asset|blob|file)(?:\\*:|&|&#)/i;
export const HISTORY_HTML_IMAGE_TAG_HINT_PATTERN = /<\s*img\b/i;

const HISTORY_IMAGE_SOURCE_PREFIXES = [
  'data:image/',
  'attachment://',
  'app-file://',
  'asset://',
  'blob:',
  'file://',
];
const HISTORY_UNSAFE_IMAGE_SOURCE_HINT_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|\/|[A-Za-z]:[\\/])/;
const HISTORY_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const HISTORY_WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const HISTORY_LOCAL_IMAGE_PATH_PATTERN = /^(?:\.{1,2}[\\/]|\/|[^/\\]+[\\/].+|[^/\\]+\.(?:png|jpe?g|webp|gif|bmp|avif|svg)(?:[?#].*)?$)/i;
const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

export function getOverflowHistoryMarkdownImageScrubEnd(
  content: string,
  targetStart: number,
  rangeEnd: number
): number {
  const lineFeed = content.indexOf('\n', targetStart);
  const carriageReturn = content.indexOf('\r', targetStart);
  return Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );
}

export function isHistoryImageSource(value: string): boolean {
  const decoded = unescapeHistoryMarkdownImageTarget(decodeMarkdownHtmlText(value)).trimStart();
  if (HISTORY_IMAGE_SOURCE_PREFIXES.some((prefix) =>
    hasAsciiCaseInsensitiveAt(decoded, prefix, 0)
  )) {
    return true;
  }
  if (
    HISTORY_WINDOWS_ABSOLUTE_PATH_PATTERN.test(decoded) ||
    (!HISTORY_URL_SCHEME_PATTERN.test(decoded) &&
      !decoded.startsWith('//') &&
      HISTORY_LOCAL_IMAGE_PATH_PATTERN.test(decoded))
  ) {
    return true;
  }
  return !normalizeRenderableImageSrc(decoded) && HISTORY_UNSAFE_IMAGE_SOURCE_HINT_PATTERN.test(decoded);
}

export function getHistoryMarkdownImageTarget(rawTarget: string): string {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('<')) {
    const closingAngle = trimmed.indexOf('>');
    return unescapeHistoryMarkdownImageTarget(decodeMarkdownHtmlText(
      closingAngle === -1 ? trimmed.slice(1) : trimmed.slice(1, closingAngle)
    )).trim();
  }

  const targetEnd = trimmed.search(/\s/);
  return unescapeHistoryMarkdownImageTarget(decodeMarkdownHtmlText(
    targetEnd === -1 ? trimmed : trimmed.slice(0, targetEnd)
  )).trim();
}

export function unescapeHistoryMarkdownImageTarget(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

export function hasAsciiCaseInsensitiveAt(content: string, needle: string, start: number): boolean {
  if (start < 0 || start + needle.length > content.length) {
    return false;
  }
  for (let offset = 0; offset < needle.length; offset += 1) {
    if (content[start + offset]?.toLowerCase() !== needle[offset]) {
      return false;
    }
  }
  return true;
}

export function indexOfAsciiCaseInsensitive(value: string, needle: string, fromIndex: number): number {
  const maxStart = value.length - needle.length;
  for (let index = Math.max(0, fromIndex); index <= maxStart; index += 1) {
    if (hasAsciiCaseInsensitiveAt(value, needle, index)) {
      return index;
    }
  }
  return -1;
}
