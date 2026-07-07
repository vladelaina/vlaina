const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);

export function isEscapedMarkdownPunctuation(content: string, offset: number, lowerBound: number): boolean {
  const char = content[offset];
  if (!char || !MARKDOWN_ESCAPABLE_PUNCTUATION.has(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= lowerBound && content[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}
