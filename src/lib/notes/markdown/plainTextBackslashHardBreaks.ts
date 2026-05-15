const BLOCK_MARKDOWN_SIGNAL_PATTERN = /(^|\n)\s{0,3}(#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|\$\$[ \t]*$|\[[^\]\n]+\]:|[-*_]{3,}[ \t]*$|\|.+\|)/m;
const SETEXT_HEADING_SIGNAL_PATTERN = /(^|\n)[^\n]+\n {0,3}(?:=+|-+)[ \t]*(?:\n|$)/;
const INLINE_MARKDOWN_SIGNAL_PATTERN = /(\[\^[^\]]+\]|\[[^\]]+\]\([^)]+\)|`[^`\n]+`|\$[^$\n]+\$|==[^=\n]+==|\+\+[^+\n]+\+\+|<(?:mark|sup|sub|u)\b[\s\S]*?<\/(?:mark|sup|sub|u)>|<span\b[^>]*style=["'][^"']*(?:color|background-color)\s*:[^"']*["'][\s\S]*?<\/span>|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/i;
const TOC_SHORTCUT_PATTERN = /^\s*(?:\[toc\]|\{:toc\})\s*$/i;
const HTML_HARD_BREAK_PATTERN = /<br\s*\/?>/i;
const LINE_ENDING_PATTERN = /\r\n?/g;
const TRAILING_WHITESPACE_PATTERN = /[ \t]*$/;

export const normalizeMarkdownLineEndings = (value: string) => value.replace(LINE_ENDING_PATTERN, '\n');

export const looksLikePlainTextWithOnlyBackslashHardBreakSignal = (value: string): boolean => {
  const normalized = normalizeMarkdownLineEndings(value);
  if (!normalized.trim()) return false;
  if (!normalized.split('\n').some(hasSingleTrailingBackslash)) return false;

  return (
    !TOC_SHORTCUT_PATTERN.test(normalized)
    && !BLOCK_MARKDOWN_SIGNAL_PATTERN.test(normalized)
    && !SETEXT_HEADING_SIGNAL_PATTERN.test(normalized)
    && !INLINE_MARKDOWN_SIGNAL_PATTERN.test(normalized)
    && !HTML_HARD_BREAK_PATTERN.test(normalized)
  );
};

export const escapePlainTextTrailingBackslashesForEditor = (value: string): string => {
  if (!looksLikePlainTextWithOnlyBackslashHardBreakSignal(value)) return value;

  return normalizeMarkdownLineEndings(value)
    .split('\n')
    .map(escapeSingleTrailingBackslash)
    .join('\n');
};

function hasSingleTrailingBackslash(line: string): boolean {
  const whitespace = line.match(TRAILING_WHITESPACE_PATTERN)?.[0] ?? '';
  const contentEnd = line.length - whitespace.length;
  let cursor = contentEnd - 1;
  let backslashCount = 0;

  while (cursor >= 0 && line[cursor] === '\\') {
    backslashCount += 1;
    cursor -= 1;
  }

  return backslashCount === 1;
}

function escapeSingleTrailingBackslash(line: string): string {
  if (!hasSingleTrailingBackslash(line)) return line;

  const whitespace = line.match(TRAILING_WHITESPACE_PATTERN)?.[0] ?? '';
  const content = line.slice(0, line.length - whitespace.length - 1);
  return `${content}\\\\\\${whitespace}`;
}
