const MARKDOWN_ESCAPED_PUNCTUATION_PATTERN = /\\([!-/:-@[-`{-~])/g;
const MAX_MARKDOWN_LINK_STRIP_DEPTH = 128;
const MAX_MARKDOWN_LINK_STRIP_NESTED_SCAN_CHARS = 4 * 1024 * 1024;

interface StripMarkdownLinksState {
  nestedScannedChars: number;
}

function unescapeMarkdownPunctuation(value: string): string {
  return value.replace(MARKDOWN_ESCAPED_PUNCTUATION_PATTERN, '$1');
}

function isEscapedMarkdownPunctuation(value: string, offset: number): boolean {
  let backslashCount = 0;
  for (let index = offset - 1; index >= 0 && value[index] === '\\'; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function getBacktickRunLength(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && value[cursor] === '`') {
    cursor += 1;
  }
  return cursor - start;
}

function findClosingCodeSpan(value: string, start: number, tickCount: number): number | null {
  let cursor = start;
  while (cursor < value.length) {
    if (value[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    const runLength = getBacktickRunLength(value, cursor);
    if (runLength === tickCount) {
      return cursor + runLength;
    }
    cursor += runLength;
  }
  return null;
}

function findMarkdownLabelEnd(value: string, start: number): number | null {
  let cursor = start;
  let bracketDepth = 0;

  while (cursor < value.length) {
    if (value[cursor] === '`') {
      const tickCount = getBacktickRunLength(value, cursor);
      const codeEnd = findClosingCodeSpan(value, cursor + tickCount, tickCount);
      cursor = codeEnd ?? cursor + tickCount;
      continue;
    }

    const char = value[cursor];
    if (char === '[' && !isEscapedMarkdownPunctuation(value, cursor)) {
      bracketDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ']' && !isEscapedMarkdownPunctuation(value, cursor)) {
      if (bracketDepth === 0) {
        return cursor;
      }
      bracketDepth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function findMarkdownTargetEnd(value: string, start: number): number | null {
  let cursor = start;
  let parenDepth = 0;
  let quote: string | null = null;

  while (cursor < value.length) {
    const char = value[cursor];
    if (quote) {
      if (char === quote && !isEscapedMarkdownPunctuation(value, cursor)) {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      cursor += 1;
      continue;
    }
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      if (parenDepth === 0) {
        return cursor + 1;
      }
      parenDepth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

export interface StripMarkdownLinksOptions {
  preserveImageAlt?: boolean;
}

export function stripMarkdownLinks(
  value: string,
  options: StripMarkdownLinksOptions = {},
): string {
  return stripMarkdownLinksInternal(value, options, 0, { nestedScannedChars: 0 });
}

function stripMarkdownLinksInternal(
  value: string,
  options: StripMarkdownLinksOptions,
  depth: number,
  state: StripMarkdownLinksState,
): string {
  if (depth > MAX_MARKDOWN_LINK_STRIP_DEPTH) {
    return '';
  }
  if (depth > 1) {
    state.nestedScannedChars += value.length;
    if (state.nestedScannedChars > MAX_MARKDOWN_LINK_STRIP_NESTED_SCAN_CHARS) {
      return '';
    }
  }

  const parts: string[] = [];
  let cursor = 0;
  let lastIndex = 0;
  const preserveImageAlt = options.preserveImageAlt !== false;

  while (cursor < value.length) {
    if (value[cursor] === '`') {
      const tickCount = getBacktickRunLength(value, cursor);
      cursor = findClosingCodeSpan(value, cursor + tickCount, tickCount) ?? cursor + tickCount;
      continue;
    }

    const isImage = value.startsWith('![', cursor) && !isEscapedMarkdownPunctuation(value, cursor);
    const isLink =
      value[cursor] === '[' &&
      value[cursor - 1] !== '!' &&
      !isEscapedMarkdownPunctuation(value, cursor);
    if (!isImage && !isLink) {
      cursor += 1;
      continue;
    }

    const labelStart = cursor + (isImage ? 2 : 1);
    const labelEnd = findMarkdownLabelEnd(value, labelStart);
    if (labelEnd === null || value[labelEnd + 1] !== '(') {
      cursor += 1;
      continue;
    }

    const targetEnd = findMarkdownTargetEnd(value, labelEnd + 2);
    if (targetEnd === null) {
      cursor += 1;
      continue;
    }

    parts.push(value.slice(lastIndex, cursor));
    if (!isImage || preserveImageAlt) {
      parts.push(stripMarkdownLinksInternal(
        value.slice(labelStart, labelEnd),
        options,
        depth + 1,
        state,
      ));
    }
    lastIndex = targetEnd;
    cursor = targetEnd;
  }

  parts.push(value.slice(lastIndex));
  return parts.join('');
}

export function stripMarkdownInline(
  value: string,
  options: StripMarkdownLinksOptions = {},
): string {
  return unescapeMarkdownPunctuation(stripMarkdownLinks(value, options)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(?<!\\)\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\\)__([^_]+)__/g, '$1')
    .replace(/(?<!\\)\*([^*]+)\*/g, '$1')
    .replace(/(?<!\\)_([^_]+)_/g, '$1')
    .replace(/(?<!\\)~~([^~]+)~~/g, '$1')
    .replace(/(?<!\\)==([^=]+)==/g, '$1')
    .replace(/(?<!\\)\+\+([^+]+)\+\+/g, '$1')
    .replace(/(?<![\\^])\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g, '$1')
    .replace(/(?<![\\~])~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim());
}

export function normalizeMarkdownInlineTextForMeasurement(
  value: string,
  options: StripMarkdownLinksOptions = {},
): string {
  return unescapeMarkdownPunctuation(stripMarkdownLinks(value, options)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim());
}
