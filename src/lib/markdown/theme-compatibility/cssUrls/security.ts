import { stripCssImportRules } from './imports';
import { findCssUrlTokens } from './tokenizer';

const UNSAFE_CSS_URL_PATTERN = /^(?:javascript|vbscript):/i;

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
