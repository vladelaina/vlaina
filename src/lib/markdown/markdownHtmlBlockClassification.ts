const HTML_MARKDOWN_BLOCK_OPEN_PATTERN =
  /^(?: {0,3})<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const HTML_COMMENT_OPEN_PATTERN = /^(?: {0,3})<!--/;
const HTML_PROCESSING_OPEN_PATTERN = /^(?: {0,3})<\?/;
const HTML_DECLARATION_OPEN_PATTERN = /^(?: {0,3})<![A-Z]/i;
const HTML_CDATA_OPEN_PATTERN = /^(?: {0,3})<!\[CDATA\[/;
const HTML_TYPE_7_TAG_LINE_PATTERN = /^(?: {0,3})<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/?>\s*$/;
const HTML_TYPE_7_EXCLUDED_TAGS = new Set([
  'math',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
  'pre',
  'script',
  'style',
  'svg',
  'textarea',
  'title',
  'xmp',
]);
const HTML_TYPE_7_SINGLETON_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const BLOCKQUOTE_PREFIX_PATTERN = /^(?: {0,3}>[ \t]?)*/;

interface MarkdownHtmlBlockClassificationOptions {
  protectHtmlComments?: boolean;
}

export function getMarkdownBlockContent(line: string): string {
  return line.slice(getMarkdownBlockContentStartOffset(line));
}

export function getMarkdownBlockContentStartOffset(line: string): number {
  return BLOCKQUOTE_PREFIX_PATTERN.exec(line)?.[0].length ?? 0;
}

export function getMarkdownInvisibleHtmlBlockClosePattern(
  line: string,
  options: MarkdownHtmlBlockClassificationOptions = {},
): RegExp | undefined {
  if (options.protectHtmlComments !== false && HTML_COMMENT_OPEN_PATTERN.test(line)) return /-->/;
  if (HTML_PROCESSING_OPEN_PATTERN.test(line)) return /\?>/;
  if (HTML_DECLARATION_OPEN_PATTERN.test(line)) return />/;
  if (HTML_CDATA_OPEN_PATTERN.test(line)) return /\]\]>/;
  return undefined;
}

export function getMarkdownHtmlBlockClosePattern(
  line: string,
  options: MarkdownHtmlBlockClassificationOptions = {},
): RegExp | null | undefined {
  const invisibleBlockClosePattern = getMarkdownInvisibleHtmlBlockClosePattern(line, options);
  if (invisibleBlockClosePattern !== undefined) return invisibleBlockClosePattern;
  if (HTML_MARKDOWN_BLOCK_OPEN_PATTERN.test(line)) return null;

  const tagLineMatch = HTML_TYPE_7_TAG_LINE_PATTERN.exec(line);
  if (!tagLineMatch) return undefined;

  const tagName = tagLineMatch[1]?.toLowerCase();
  if (
    tagName
    && !tagLineMatch[0].trimStart().startsWith('</')
    && !/\/>\s*$/.test(tagLineMatch[0])
    && !HTML_TYPE_7_EXCLUDED_TAGS.has(tagName)
    && !HTML_TYPE_7_SINGLETON_TAGS.has(tagName)
  ) {
    return null;
  }
  return undefined;
}
