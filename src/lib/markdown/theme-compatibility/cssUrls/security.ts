import { stripCssImportRules } from './imports';
import { findCssUrlTokens } from './tokenizer';
import { decodeCssEscapesForUrl } from './cssEscapes';

const UNSAFE_SCRIPT_CSS_URL_PATTERN = /^(?:javascript|vbscript):/i;
const FILE_CSS_URL_PATTERN = /^file:/i;
const MANAGED_THEME_CACHE_PATH_SEGMENT = '/.vlaina/store/markdown-theme-cache/';

function normalizeCssUrlForProtocolCheck(url: string): string {
  return decodeCssEscapesForUrl(url.trim())
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .toLowerCase();
}

function isUnsafeCssUrl(url: string): boolean {
  const normalizedUrl = normalizeCssUrlForProtocolCheck(url);
  if (UNSAFE_SCRIPT_CSS_URL_PATTERN.test(normalizedUrl)) {
    return true;
  }
  return FILE_CSS_URL_PATTERN.test(normalizedUrl) && !isManagedThemeCacheFileUrl(normalizedUrl);
}

function isManagedThemeCacheFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return false;
    }

    const decodedPath = decodeURIComponent(parsed.pathname).replace(/\\/g, '/').toLowerCase();
    const normalizedParts: string[] = [];
    for (const part of decodedPath.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        normalizedParts.pop();
        continue;
      }
      normalizedParts.push(part);
    }

    return `/${normalizedParts.join('/')}/`.includes(MANAGED_THEME_CACHE_PATH_SEGMENT);
  } catch {
    return false;
  }
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
