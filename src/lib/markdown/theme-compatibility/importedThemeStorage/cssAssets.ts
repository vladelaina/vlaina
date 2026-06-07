import {
  getStorageAdapter,
} from '@/lib/storage/adapter';
import {
  sanitizeImportedMarkdownThemeCss,
} from '../cssUrls';
import type { ImportedMarkdownThemeMetadata } from '../types';
import { inlineRelativeThemeCssImports } from './cssImports';
import { getThemeAssetDirPath, getThemeCssPath } from './paths';
import { rewriteImportedThemeAssetUrls } from './themeAssets';

export async function sanitizeImportedCss(
  css: string,
  themeId: string,
  sourcePath?: string | null
): Promise<string> {
  const cssWithLocalImports = await inlineRelativeThemeCssImports(css, sourcePath);
  const sanitized = sanitizeImportedMarkdownThemeCss(cssWithLocalImports);
  return rewriteImportedThemeAssetUrls(sanitized, themeId, sourcePath);
}

export async function cachedThemeCssExists(theme: ImportedMarkdownThemeMetadata): Promise<boolean> {
  return getStorageAdapter().exists(await getThemeCssPath(theme.cssFile)).catch(() => false);
}

export async function deleteImportedThemeFiles(metadata: ImportedMarkdownThemeMetadata): Promise<void> {
  const storage = getStorageAdapter();
  await storage.deleteFile(await getThemeCssPath(metadata.cssFile)).catch(() => undefined);
  await storage.deleteDir(await getThemeAssetDirPath(metadata.id), true).catch(() => undefined);
}

export async function writeImportedThemeCss(
  metadata: ImportedMarkdownThemeMetadata,
  css: string
): Promise<void> {
  await getStorageAdapter().deleteDir(await getThemeAssetDirPath(metadata.id), true).catch(() => undefined);
  await getStorageAdapter().writeFile(
    await getThemeCssPath(metadata.cssFile),
    await sanitizeImportedCss(css, metadata.id, metadata.sourcePath),
    { recursive: true }
  );
}
