import type { CssUrlToken } from './types';

export const MAX_MARKDOWN_THEME_CSS_URL_TOKENS = 1024;
export const MAX_MARKDOWN_THEME_CSS_URL_VALUE_CHARS = 4096;

export function findCssUrlTokens(css: string): CssUrlToken[] {
  const tokens: CssUrlToken[] = [];
  let index = 0;

  while (index < css.length) {
    const functionIndex = findNextCssUrlFunction(css, index);
    if (functionIndex < 0) break;

    let cursor = functionIndex + 4;
    while (/\s/.test(css[cursor] ?? '')) cursor += 1;

    const quote = css[cursor] === '"' || css[cursor] === "'" ? css[cursor] : null;
    const valueStart = quote ? cursor + 1 : cursor;
    let valueEnd = valueStart;
    let closeIndex = -1;

    if (quote) {
      let escaped = false;
      for (cursor = valueStart; cursor < css.length; cursor += 1) {
        const char = css[cursor];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === quote) {
          valueEnd = cursor;
          cursor += 1;
          while (/\s/.test(css[cursor] ?? '')) cursor += 1;
          if (css[cursor] === ')') {
            closeIndex = cursor;
          }
          break;
        }
      }
    } else {
      let nestedParenDepth = 0;
      for (cursor = valueStart; cursor < css.length; cursor += 1) {
        const char = css[cursor];
        if (char === '(') {
          nestedParenDepth += 1;
          continue;
        }
        if (char === ')') {
          if (nestedParenDepth === 0) {
            valueEnd = cursor;
            closeIndex = cursor;
            break;
          }
          nestedParenDepth -= 1;
        }
      }
    }

    if (closeIndex < 0) {
      index = functionIndex + 4;
      continue;
    }

    const url = css.slice(valueStart, valueEnd).trim();
    tokens.push({
      start: functionIndex,
      end: closeIndex + 1,
      raw: css.slice(functionIndex, closeIndex + 1),
      url,
    });
    if (tokens.length >= MAX_MARKDOWN_THEME_CSS_URL_TOKENS) {
      return tokens;
    }
    index = closeIndex + 1;
  }

  return tokens;
}

function findNextCssUrlFunction(css: string, start: number): number {
  let quote: string | null = null;
  let escaped = false;
  let inComment = false;

  for (let index = start; index < css.length - 3; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (css.slice(index, index + 4).toLowerCase() === 'url(') {
      const previous = css[index - 1] ?? '';
      if (!previous || !/[-_a-z0-9]/i.test(previous)) {
        return index;
      }
    }
  }

  return -1;
}
