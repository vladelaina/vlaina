import { mapMarkdownOutsideProtectedBlocks } from './markdownProtectedBlocks';

const BLOCK_MARKDOWN_SIGNAL_PATTERN = /(^|\n)\s{0,3}(#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|\$\$[ \t]*$|\[[^\]\n]+\]:|[-*_]{3,}[ \t]*$|\|.+\|)/m;
const SETEXT_HEADING_SIGNAL_PATTERN = /(^|\n)[^\n]+\n {0,3}(?:=+|-+)[ \t]*(?:\n|$)/;
const INLINE_MARKDOWN_SIGNAL_PATTERN = /(\[\^[^\]]+\]|\[[^\]]+\]\([^)]+\)|`[^`\n]+`|\$[^$\n]+\$|==[^=\n]+==|\+\+[^+\n]+\+\+|<(?:mark|sup|sub|u)\b[\s\S]*?<\/(?:mark|sup|sub|u)>|<span\b[^>]*style=["'][^"']*(?:color|background-color)\s*:[^"']*["'][\s\S]*?<\/span>|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/i;
const BLOCK_MARKDOWN_LINE_PATTERN = /^\s{0,3}(#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|\$\$[ \t]*$|\[[^\]\n]+\]:|[-*_]{3,}[ \t]*$|\|.+\|)/;
const SETEXT_HEADING_UNDERLINE_PATTERN = /^ {0,3}(?:=+|-+)[ \t]*$/;
const TOC_SHORTCUT_PATTERN = /^\s*(?:\[toc\]|\{:toc\})\s*$/i;
const HTML_HARD_BREAK_PATTERN = /<br\s*\/?>/i;
const LINE_ENDING_PATTERN = /\r\n?/g;
const TRAILING_WHITESPACE_PATTERN = /[ \t]*$/;

export const normalizeMarkdownLineEndings = (value: string) => value.replace(LINE_ENDING_PATTERN, '\n');

export const looksLikePlainTextWithOnlyBackslashHardBreakSignal = (value: string): boolean => {
  const normalized = normalizeMarkdownLineEndings(value);
  if (!normalized.trim()) return false;
  if (!hasAnySingleTrailingBackslashLine(normalized)) return false;

  return (
    !TOC_SHORTCUT_PATTERN.test(normalized)
    && !BLOCK_MARKDOWN_SIGNAL_PATTERN.test(normalized)
    && !SETEXT_HEADING_SIGNAL_PATTERN.test(normalized)
    && !INLINE_MARKDOWN_SIGNAL_PATTERN.test(normalized)
    && !HTML_HARD_BREAK_PATTERN.test(normalized)
  );
};

function hasAnySingleTrailingBackslashLine(text: string): boolean {
  let lineStart = 0;

  for (let cursor = 0; cursor <= text.length; cursor += 1) {
    if (cursor < text.length && text[cursor] !== '\n') continue;
    if (hasSingleTrailingBackslash(text.slice(lineStart, cursor))) return true;
    lineStart = cursor + 1;
  }

  return false;
}

export const escapeParagraphTrailingBackslashesForEditor = (value: string): string => {
  return mapMarkdownOutsideProtectedBlocks(
    normalizeMarkdownLineEndings(value),
    escapeParagraphTrailingBackslashLine
  );
};

function escapeParagraphTrailingBackslashLine(
  line: string,
  index: number,
  lines: readonly string[],
): string {
  if (!hasSingleTrailingBackslash(line)) return line;
  if (TOC_SHORTCUT_PATTERN.test(line)) return line;
  if (BLOCK_MARKDOWN_LINE_PATTERN.test(line)) return line;
  if (HTML_HARD_BREAK_PATTERN.test(line)) return line;
  if (isSetextHeadingContentLine(line, lines[index + 1])) return line;
  return escapeSingleTrailingBackslash(line);
}

function isSetextHeadingContentLine(line: string, nextLine: string | undefined): boolean {
  return line.trim().length > 0 && SETEXT_HEADING_UNDERLINE_PATTERN.test(nextLine ?? '');
}

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
