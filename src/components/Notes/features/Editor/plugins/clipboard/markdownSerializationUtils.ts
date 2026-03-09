const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;

function unescapeMarkdownPunctuation(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_PATTERN, '$1');
}

export function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

export function normalizeSerializedMarkdownBlock(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(text);
  if (BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(text);
  if (BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '\n';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function joinSerializedBlocks(blocks: readonly string[]): string {
  const joined = blocks.join('\n');
  if (joined.length === 0 && blocks.length > 0) {
    return '\n';
  }
  return joined;
}
