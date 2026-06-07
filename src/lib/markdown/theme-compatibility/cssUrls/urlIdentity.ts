import { isAbsolutePath } from '@/lib/storage/adapter';

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const CSS_DYNAMIC_URL_PATTERN = /^(?:var|env|attr)\(/i;

export function isRelativeCssAssetUrl(url: string): boolean {
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
