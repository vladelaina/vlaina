import { getParentPath, isAbsolutePath, joinPath, toFileUrl } from '@/lib/storage/adapter';
import postcss from 'postcss';

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const CSS_DYNAMIC_URL_PATTERN = /^(?:var|env|attr)\(/i;
const UNSAFE_CSS_URL_PATTERN = /^(?:javascript|vbscript):/i;

interface CssUrlToken {
  start: number;
  end: number;
  raw: string;
  url: string;
}

export interface RelativeMarkdownThemeCssUrl {
  url: string;
  path: string;
  suffix: string;
}

function isRelativeCssAssetUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return false;
  if (isAbsolutePath(trimmed)) return false;
  if (ABSOLUTE_URL_PATTERN.test(trimmed)) return false;
  if (CSS_DYNAMIC_URL_PATTERN.test(trimmed)) return false;
  return true;
}

function splitCssUrlSuffix(url: string): { path: string; suffix: string } {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const suffixIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (suffixIndex === undefined) {
    return { path: url, suffix: '' };
  }

  return {
    path: url.slice(0, suffixIndex),
    suffix: url.slice(suffixIndex),
  };
}

function renderCssUrl(url: string): string {
  return `url("${url.replace(/"/g, '\\"')}")`;
}

export interface MarkdownThemeCssImport {
  url: string;
  path: string;
  suffix: string;
}

function stripCssImportRules(css: string): string {
  const root = postcss.parse(css, { from: undefined });
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import') {
      rule.remove();
    }
  });
  return root.toString();
}

export function getRelativeMarkdownThemeCssImports(css: string): MarkdownThemeCssImport[] {
  const root = postcss.parse(css, { from: undefined });
  const imports: MarkdownThemeCssImport[] = [];

  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() !== 'import') return;

    const url = getCssImportUrl(rule.params);
    if (!url || !isRelativeCssAssetUrl(url)) return;

    const { path, suffix } = splitCssUrlSuffix(url);
    if (!path.toLowerCase().endsWith('.css')) return;

    imports.push({ url, path, suffix });
  });

  return imports;
}

function getCssImportUrl(params: string): string | null {
  const trimmed = params.trim();
  const urlFunctionMatch = trimmed.match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s][^)]*?))\s*\)/i);
  if (urlFunctionMatch) {
    return (urlFunctionMatch[1] ?? urlFunctionMatch[2] ?? urlFunctionMatch[3] ?? '').trim() || null;
  }

  const quotedMatch = trimmed.match(/^"([^"]+)"|^'([^']+)'/);
  return (quotedMatch?.[1] ?? quotedMatch?.[2] ?? '').trim() || null;
}

function decodeCssEscapesForSecurity(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|[\s\S])/gi, (_match, escaped: string) => {
    if (/^[0-9a-f]/i.test(escaped)) {
      const codePoint = Number.parseInt(escaped.trim(), 16);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
        return '';
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return '';
      }
    }

    if (escaped === '\n' || escaped === '\r') {
      return '';
    }

    return escaped;
  });
}

function normalizeCssUrlForProtocolCheck(url: string): string {
  return decodeCssEscapesForSecurity(url.trim())
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .toLowerCase();
}

function isUnsafeCssUrl(url: string): boolean {
  return UNSAFE_CSS_URL_PATTERN.test(normalizeCssUrlForProtocolCheck(url));
}

function findCssUrlTokens(css: string): CssUrlToken[] {
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

    tokens.push({
      start: functionIndex,
      end: closeIndex + 1,
      raw: css.slice(functionIndex, closeIndex + 1),
      url: css.slice(valueStart, valueEnd).trim(),
    });
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

export async function rebaseRelativeMarkdownThemeCssUrls(
  css: string,
  sourcePath?: string | null
): Promise<string> {
  return rewriteRelativeMarkdownThemeCssUrls(css, sourcePath, async ({ path, suffix }) => {
    const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
    if (!sourceDir) return null;

    const assetPath = await joinPath(sourceDir, path);
    return `${await toFileUrl(assetPath)}${suffix}`;
  });
}

export async function rewriteRelativeMarkdownThemeCssUrls(
  css: string,
  sourcePath: string | null | undefined,
  resolveAssetUrl: (asset: RelativeMarkdownThemeCssUrl) => Promise<string | null>
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  if (!sourceDir) {
    return css;
  }

  const tokens = findCssUrlTokens(css);
  if (tokens.length === 0) {
    return css;
  }

  const replacements = await Promise.all(
    tokens.map(async (token) => {
      if (!isRelativeCssAssetUrl(token.url)) {
        return token.raw;
      }

      const { path, suffix } = splitCssUrlSuffix(token.url);
      try {
        const resolvedUrl = await resolveAssetUrl({ url: token.url, path, suffix });
        return resolvedUrl ? renderCssUrl(resolvedUrl) : token.raw;
      } catch {
        return token.raw;
      }
    })
  );

  let output = '';
  let cursor = 0;
  tokens.forEach((token, tokenIndex) => {
    output += css.slice(cursor, token.start);
    output += replacements[tokenIndex] ?? token.raw;
    cursor = token.end;
  });
  return output + css.slice(cursor);
}

export function sanitizeUnsafeMarkdownThemeCssUrls(css: string): string {
  const tokens = findCssUrlTokens(css);
  if (tokens.length === 0) {
    return css;
  }

  let output = '';
  let cursor = 0;
  tokens.forEach((token) => {
    output += css.slice(cursor, token.start);
    output += isUnsafeCssUrl(token.url)
      ? 'url("")'
      : token.raw;
    cursor = token.end;
  });
  return output + css.slice(cursor);
}

export function sanitizeImportedMarkdownThemeCss(css: string): string {
  return sanitizeUnsafeMarkdownThemeCssUrls(stripCssImportRules(css));
}
