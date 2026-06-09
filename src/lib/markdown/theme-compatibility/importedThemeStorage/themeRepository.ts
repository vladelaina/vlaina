import { getStorageAdapter } from '@/lib/storage/adapter';
import { detectMarkdownThemePlatform } from '../platformDetection';
import {
  isMarkdownThemePlatform,
  isSafeImportedMarkdownThemeId,
  type ImportedMarkdownTheme,
  type ImportedMarkdownThemeMetadata,
  type MarkdownThemePlatform,
} from '../types';
import { MAX_IMPORTED_THEME_CSS_BYTES } from './constants';
import { deleteImportedThemeFiles, writeImportedThemeCss } from './cssAssets';
import {
  findThemeBySourcePath,
  isThemeSourceInsideDirectory,
  resolveUniqueThemeId,
  sanitizeCssFilename,
  sanitizeThemeName,
  sortThemes,
  stripCssExtension,
} from './metadata';
import { getImportedMarkdownThemesDirectoryPath, getThemeCssPath } from './paths';
import { readThemeIndex, writeThemeIndex } from './themeIndex';

export async function upsertImportedMarkdownThemeCss({
  name,
  platform,
  css,
  sourcePath = null,
  sourceModifiedAt = null,
  sourceSize = null,
  themes,
}: {
  name: string;
  platform?: MarkdownThemePlatform;
  css: string;
  sourcePath?: string | null;
  sourceModifiedAt?: number | null;
  sourceSize?: number | null;
  themes: ImportedMarkdownThemeMetadata[];
}): Promise<{
  metadata: ImportedMarkdownThemeMetadata;
  themes: ImportedMarkdownThemeMetadata[];
}> {
  const detectedPlatform = platform ?? detectMarkdownThemePlatform(css);
  if (!isMarkdownThemePlatform(detectedPlatform)) {
    throw new Error('Unsupported markdown theme platform.');
  }

  const existing = sourcePath ? findThemeBySourcePath(themes, sourcePath) : null;
  const now = Date.now();
  const id = existing?.id ?? resolveUniqueThemeId(name, themes);
  const metadata: ImportedMarkdownThemeMetadata = {
    id,
    name: sanitizeThemeName(stripCssExtension(name)),
    platform: detectedPlatform,
    cssFile: sanitizeCssFilename(id),
    sourcePath,
    sourceModifiedAt,
    sourceSize,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeImportedThemeCss(metadata, css);

  return {
    metadata,
    themes: sortThemes([metadata, ...themes.filter((theme) => theme.id !== metadata.id)]),
  };
}

export async function listImportedMarkdownThemes(
  platform?: MarkdownThemePlatform
): Promise<ImportedMarkdownThemeMetadata[]> {
  const themes = await readThemeIndex();
  return platform ? themes.filter((theme) => theme.platform === platform) : themes;
}

export async function listImportedMarkdownThemesFromDirectory(): Promise<ImportedMarkdownThemeMetadata[]> {
  const directoryPath = await getImportedMarkdownThemesDirectoryPath();
  return sortThemes((await readThemeIndex()).filter((theme) => isThemeSourceInsideDirectory(theme, directoryPath)));
}

export async function readImportedMarkdownThemeMetadata(id: string): Promise<ImportedMarkdownThemeMetadata | null> {
  if (!isSafeImportedMarkdownThemeId(id)) return null;
  const themes = await readThemeIndex();
  return themes.find((theme) => theme.id === id) ?? null;
}

export async function readImportedMarkdownTheme(id: string): Promise<ImportedMarkdownTheme | null> {
  const metadata = await readImportedMarkdownThemeMetadata(id);
  if (!metadata) return null;

  const storage = getStorageAdapter();
  try {
    const cssPath = await getThemeCssPath(metadata.cssFile);
    const info = await storage.stat(cssPath).catch(() => null);
    if (
      info?.isFile === false ||
      typeof info?.size !== 'number' ||
      info.size > MAX_IMPORTED_THEME_CSS_BYTES
    ) {
      return null;
    }
    const css = await storage.readFile(cssPath);
    if (css.length > MAX_IMPORTED_THEME_CSS_BYTES) {
      return null;
    }
    return {
      ...metadata,
      css,
    };
  } catch {
    return null;
  }
}

export async function importMarkdownThemeCss({
  name,
  platform,
  css,
  sourcePath = null,
  sourceModifiedAt = null,
  sourceSize = null,
}: {
  name: string;
  platform?: MarkdownThemePlatform;
  css: string;
  sourcePath?: string | null;
  sourceModifiedAt?: number | null;
  sourceSize?: number | null;
}): Promise<ImportedMarkdownThemeMetadata> {
  const themes = await readThemeIndex();
  const { metadata, themes: nextThemes } = await upsertImportedMarkdownThemeCss({
    name,
    platform,
    css,
    sourcePath,
    sourceModifiedAt,
    sourceSize,
    themes,
  });
  await writeThemeIndex(nextThemes);
  return metadata;
}

export async function deleteImportedMarkdownTheme(id: string): Promise<void> {
  if (!isSafeImportedMarkdownThemeId(id)) return;
  const themes = await readThemeIndex();
  const metadata = themes.find((theme) => theme.id === id);
  const nextThemes = themes.filter((theme) => theme.id !== id);
  await writeThemeIndex(nextThemes);

  if (metadata) {
    await deleteImportedThemeFiles(metadata);
  }
}
