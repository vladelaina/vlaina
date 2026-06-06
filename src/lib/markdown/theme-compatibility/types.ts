export type MarkdownThemePlatform = 'typora' | 'obsidian';

export interface ImportedMarkdownThemeMetadata {
  id: string;
  name: string;
  platform: MarkdownThemePlatform;
  cssFile: string;
  sourcePath?: string | null;
  sourceModifiedAt?: number | null;
  sourceSize?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ImportedMarkdownTheme extends ImportedMarkdownThemeMetadata {
  css: string;
}

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,120}$/;

export function isMarkdownThemePlatform(value: unknown): value is MarkdownThemePlatform {
  return value === 'typora' || value === 'obsidian';
}

export function normalizeImportedMarkdownThemeId(id: string): string {
  const normalized = id.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized || !THEME_ID_PATTERN.test(normalized)) {
    return `theme-${crypto.randomUUID()}`;
  }
  return normalized;
}

export function isSafeImportedMarkdownThemeId(id: unknown): id is string {
  return typeof id === 'string' && THEME_ID_PATTERN.test(id);
}
