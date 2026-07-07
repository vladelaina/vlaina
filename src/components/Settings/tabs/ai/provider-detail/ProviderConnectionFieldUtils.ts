import type { CSSProperties } from 'react';

const API_KEY_PREFIX_VISIBLE_CHARS = 7;
const API_KEY_SUFFIX_VISIBLE_CHARS = 4;

export function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return '';
  }

  if (apiKey.length <= API_KEY_PREFIX_VISIBLE_CHARS + API_KEY_SUFFIX_VISIBLE_CHARS) {
    return apiKey.slice(-API_KEY_SUFFIX_VISIBLE_CHARS);
  }

  return `${apiKey.slice(0, API_KEY_PREFIX_VISIBLE_CHARS)}••••••${apiKey.slice(-API_KEY_SUFFIX_VISIBLE_CHARS)}`;
}

export function getApiKeyInputStyle(displayValue: string, availableTextWidthPx = 410): CSSProperties {
  const averageMonoCharWidthEm = 0.62;
  const maxFontSizePx = 14;
  const minFontSizePx = 12;

  if (!displayValue) {
    return { fontSize: maxFontSizePx };
  }

  const fittedFontSize = Math.floor(availableTextWidthPx / Math.max(displayValue.length * averageMonoCharWidthEm, 1));
  return {
    fontSize: Math.max(minFontSizePx, Math.min(maxFontSizePx, fittedFontSize)),
  };
}

export function getApiKeyEditableSelectionRange(apiKey: string): { start: number; end: number } {
  const prefix = 'sk-';
  if (apiKey.startsWith(prefix) && apiKey.length > prefix.length) {
    return { start: prefix.length, end: apiKey.length };
  }

  return { start: 0, end: apiKey.length };
}

export function isDefaultChannelName(name: string): boolean {
  return /^channel\s*\d+$/i.test(name.trim());
}
