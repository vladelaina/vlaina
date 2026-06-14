import {
  getBaseName,
  normalizePath,
  type FileInfo,
} from '@/lib/storage/adapter';
import {
  isMarkdownThemePlatform,
  isSafeImportedMarkdownThemeId,
  normalizeImportedMarkdownThemeId,
  type ImportedMarkdownThemeMetadata,
} from '../types';
import { decodeCssEscapesForUrl } from '../cssUrls/cssEscapes';
import { CSS_EXTENSION } from './constants';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeCssFilename(id: string): string {
  return `${normalizeImportedMarkdownThemeId(id)}${CSS_EXTENSION}`;
}

export function sanitizeAssetFilename(path: string, index: number): string {
  return normalizeImportedMarkdownThemeId(`${index}-${getBaseName(path) || 'asset'}`);
}

export function sanitizeThemeName(name: string): string {
  const normalized = name.replace(/\s+/g, ' ').trim();
  return normalized || 'Imported theme';
}

export function stripCssExtension(name: string): string {
  return name.toLowerCase().endsWith(CSS_EXTENSION)
    ? name.slice(0, -CSS_EXTENSION.length)
    : name;
}

export function parseThemeMetadata(value: unknown): ImportedMarkdownThemeMetadata | null {
  if (!isRecord(value)) return null;
  const { id, name, platform, cssFile, sourcePath, sourceModifiedAt, sourceSize, createdAt, updatedAt } = value;
  if (
    !isSafeImportedMarkdownThemeId(id) ||
    typeof name !== 'string' ||
    !isMarkdownThemePlatform(platform) ||
    typeof cssFile !== 'string' ||
    !cssFile.endsWith(CSS_EXTENSION) ||
    typeof createdAt !== 'number' ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id,
    name: sanitizeThemeName(name),
    platform,
    cssFile: sanitizeCssFilename(id),
    sourcePath: typeof sourcePath === 'string' && sourcePath.trim() ? sourcePath : null,
    sourceModifiedAt: typeof sourceModifiedAt === 'number' && Number.isFinite(sourceModifiedAt)
      ? sourceModifiedAt
      : null,
    sourceSize: typeof sourceSize === 'number' && Number.isFinite(sourceSize) && sourceSize >= 0
      ? sourceSize
      : null,
    createdAt,
    updatedAt,
  };
}

export function parseThemeIndex(value: unknown): ImportedMarkdownThemeMetadata[] {
  if (!isRecord(value) || !Array.isArray(value.themes)) return [];
  return value.themes
    .map(parseThemeMetadata)
    .filter((theme): theme is ImportedMarkdownThemeMetadata => theme !== null);
}

export function resolveUniqueThemeId(name: string, themes: ImportedMarkdownThemeMetadata[]): string {
  const existingIds = new Set(themes.map((theme) => theme.id));
  const baseId = normalizeImportedMarkdownThemeId(stripCssExtension(name));
  if (!existingIds.has(baseId)) return baseId;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const nextId = normalizeImportedMarkdownThemeId(`${baseId}-${suffix}`);
    if (!existingIds.has(nextId)) return nextId;
  }

  return normalizeImportedMarkdownThemeId(`${baseId}-${crypto.randomUUID()}`);
}

export function normalizeThemePath(path: string): string {
  return normalizePath(path, true).replace(/\/+$/, '');
}

const UNSAFE_THEME_RELATIVE_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function normalizeThemeRelativePathInsideDirectory(
  directoryPath: string,
  relativePath: string
): string | null {
  if (!directoryPath || !relativePath) return null;
  const decodedPath = decodeCssEscapesForUrl(relativePath).trim().replace(/\\/g, '/');
  if (
    !decodedPath ||
    UNSAFE_THEME_RELATIVE_PATH_CHARS.test(decodedPath) ||
    decodedPath.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(decodedPath) ||
    /^\/\/[^/]+\/[^/]+/.test(decodedPath)
  ) {
    return null;
  }

  const parts: string[] = [];
  for (const part of decodedPath.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.length > 0 ? parts.join('/') : null;
}

export function isThemeRelativePathInsideDirectory(directoryPath: string, relativePath: string): boolean {
  return normalizeThemeRelativePathInsideDirectory(directoryPath, relativePath) !== null;
}

export function isSameThemePath(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && normalizeThemePath(left) === normalizeThemePath(right));
}

export function isThemeSourceInsideDirectory(
  theme: ImportedMarkdownThemeMetadata,
  directoryPath: string
): boolean {
  if (!theme.sourcePath) return false;
  const sourcePath = normalizeThemePath(theme.sourcePath);
  const directory = normalizeThemePath(directoryPath);
  return sourcePath === directory || sourcePath.startsWith(`${directory}/`);
}

export function findThemeBySourcePath(
  themes: ImportedMarkdownThemeMetadata[],
  sourcePath: string | null | undefined
): ImportedMarkdownThemeMetadata | null {
  if (!sourcePath) return null;
  return themes.find((theme) => isSameThemePath(theme.sourcePath, sourcePath)) ?? null;
}

export function getCssThemeEntries(entries: FileInfo[]): FileInfo[] {
  return entries
    .filter((entry) => entry.isFile && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith(CSS_EXTENSION))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getThemeSourceSignature(entry: FileInfo): {
  sourceModifiedAt: number | null;
  sourceSize: number | null;
} {
  return {
    sourceModifiedAt: typeof entry.modifiedAt === 'number' && Number.isFinite(entry.modifiedAt)
      ? entry.modifiedAt
      : null,
    sourceSize: typeof entry.size === 'number' && Number.isFinite(entry.size) && entry.size >= 0
      ? entry.size
      : null,
  };
}

export function hasThemeSourceSignatureChanged(
  theme: ImportedMarkdownThemeMetadata,
  entry: FileInfo
): boolean {
  const signature = getThemeSourceSignature(entry);
  return theme.sourceModifiedAt !== signature.sourceModifiedAt || theme.sourceSize !== signature.sourceSize;
}

export function sortThemes(themes: ImportedMarkdownThemeMetadata[]): ImportedMarkdownThemeMetadata[] {
  return [...themes].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}
