const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;

export function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

export function normalizeSerializedMarkdownBlock(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(text);
  return BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim()) ? '' : withoutTrailingNewlines;
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(text);
  return BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim()) ? '\n' : withoutTrailingNewlines;
}

export function joinSerializedBlocks(blocks: readonly string[]): string {
  const joined = blocks.join('\n');
  if (joined.length === 0 && blocks.length > 0) {
    return '\n';
  }
  return joined;
}
