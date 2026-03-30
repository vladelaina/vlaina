const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;
const EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:(?:[-+*]|\d+\.)\s+(?:\[(?: |x|X)\]\s+)?)?)<br\s*\/?>$/gim;
const EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN = /(\|\s*)<br\s*\/?>(\s*\|)/g;
const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+\.)\s+(?:\[(?: |x|X)\]\s+)?/;

function unescapeMarkdownPunctuation(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_PATTERN, '$1');
}

function stripEmptyMarkdownPlaceholders(text: string): string {
  return text
    .replace(EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
      prefix.trimEnd()
    )
    .replace(EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, '$1 $2');
}

export function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

export function normalizeSerializedMarkdownBlock(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(
    stripEmptyMarkdownPlaceholders(text)
  );
  if (BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const isStandaloneBreak = BR_ONLY_PATTERN.test(stripTrailingNewlines(text).trim());
  const withoutTrailingNewlines = stripTrailingNewlines(
    stripEmptyMarkdownPlaceholders(text)
  );
  if (isStandaloneBreak || BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '\n';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function joinSerializedBlocks(blocks: readonly string[]): string {
  if (blocks.length === 0) return '';

  let joined = blocks[0] ?? '';
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1] ?? '';
    const next = blocks[index] ?? '';
    const separator =
      previous.length === 0
      || next.length === 0
      || (LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next))
        ? '\n'
        : '\n\n';
    joined += separator + next;
  }

  if (joined.length === 0) {
    return '\n';
  }
  return joined;
}
