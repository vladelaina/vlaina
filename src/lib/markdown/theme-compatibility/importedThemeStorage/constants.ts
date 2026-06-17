export const USER_THEMES_DIR = 'app/themes';
export const THEME_CACHE_DIR = 'app/cache/markdown-themes';
export const THEME_INDEX_FILE = 'themes.json';
export const CSS_EXTENSION = '.css';
export const MAX_IMPORTED_THEME_CSS_BYTES = 1024 * 1024;
export const MAX_IMPORTED_THEME_INDEX_BYTES = 256 * 1024;
export const MAX_IMPORTED_THEME_DIRECTORY_CSS_FILES = 100;
export const MAX_IMPORTED_THEME_CSS_IMPORTS = 100;
export const MAX_IMPORTED_THEME_CSS_IMPORT_DEPTH = 8;
export const MAX_IMPORTED_THEME_ASSETS = 500;
export const MAX_IMPORTED_THEME_ASSET_BYTES = 10 * 1024 * 1024;

export function isKnownImportedThemeFileSizeWithinLimit(size: number, maxBytes: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

export function hasInvalidImportedThemeFileSize(
  info: { size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  return typeof info?.size === 'number' && !isKnownImportedThemeFileSizeWithinLimit(info.size, maxBytes);
}

export function getKnownImportedThemeModifiedAt(
  modifiedAt: number | null | undefined,
): number | undefined {
  return typeof modifiedAt === 'number' && Number.isFinite(modifiedAt)
    ? modifiedAt
    : undefined;
}
