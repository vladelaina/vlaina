const EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER = '<!--vlaina-markdown-blank-line-->';
const EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER = '<!--vlaina-rendered-html-boundary-blank-line-->';
const HTML_ONE_LINE_RENDERED_BLOCK_PATTERN =
  /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)[\s\S]*?(?:<\/\1>|\/>)[ \t]*$/;
const HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN =
  /^(?: {0,3})<(?:img|hr|br)(?:\s|\/?>|$)[\s\S]*$/i;
const HTML_CLOSING_RENDERED_BLOCK_PATTERN =
  /^(?: {0,3})<\/([A-Za-z][A-Za-z0-9-]*)\s*>[ \t]*$/;
const NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES = new Set([
  'base',
  'basefont',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'script',
  'style',
  'pre',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'math',
  'noscript',
  'svg',
]);

export function exposeRenderedHtmlBoundaryBlankLinesForEditor(text: string): string {
  if (!text.includes('\n\n')) return text;

  const lines = text.split('\n');
  let changed = false;
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    output.push(line);
    if (line.trim() !== '') continue;

    const previous = findNearestNonBlankLine(lines, index, -1);
    const next = findNearestNonBlankLine(lines, index, 1);
    if (!next || !isRenderedHtmlBoundaryBlockLine(previous)) continue;
    if ((lines[index + 1] ?? '').trim() === EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER) continue;
    if ((lines[index + 1] ?? '').trim() === EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER) continue;

    changed = true;
    output.push(EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER);
  }

  return changed ? output.join('\n') : text;
}

function isRenderedHtmlBoundaryBlockLine(line: string | null): boolean {
  if (line === null) return false;

  const match = HTML_ONE_LINE_RENDERED_BLOCK_PATTERN.exec(line)
    ?? HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN.exec(line);
  const closingTagName = HTML_CLOSING_RENDERED_BLOCK_PATTERN.exec(line)?.[1]?.toLowerCase();
  const tagName = match?.[1]?.toLowerCase() ?? closingTagName ?? getHtmlStartTagName(line);
  return Boolean(tagName && !NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES.has(tagName));
}

function getHtmlStartTagName(line: string): string | null {
  const match = /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/.exec(line);
  return match?.[1]?.toLowerCase() ?? null;
}

function findNearestNonBlankLine(
  lines: readonly string[],
  startIndex: number,
  direction: -1 | 1,
): string | null {
  for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
}
