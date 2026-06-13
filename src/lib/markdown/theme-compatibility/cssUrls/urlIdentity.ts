import { isAbsolutePath } from '@/lib/storage/adapter';
import { decodeCssEscapesForUrl } from './cssEscapes';

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const CSS_DYNAMIC_URL_PATTERN = /^(?:var|env|attr)\(/i;

export function isRelativeCssAssetUrl(url: string): boolean {
  const trimmed = url.trim();
  const decoded = decodeCssEscapesForUrl(trimmed).trim();
  const compactedDecoded = decoded.replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (!trimmed) return false;
  if (decoded.startsWith('#')) return false;
  if (decoded.startsWith('//')) return false;
  if (decoded.startsWith('/')) return false;
  if (isAbsolutePath(decoded)) return false;
  if (ABSOLUTE_URL_PATTERN.test(compactedDecoded)) return false;
  if (CSS_DYNAMIC_URL_PATTERN.test(compactedDecoded)) return false;
  return true;
}

export function splitCssUrlSuffix(url: string): { path: string; suffix: string } {
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

export function renderCssUrl(url: string): string {
  return `url("${url.replace(/"/g, '\\"')}")`;
}
