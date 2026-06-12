import {
  getStorageAdapter,
} from '@/lib/storage/adapter';
import {
  sanitizeImportedMarkdownThemeCss,
} from '../cssUrls';
import type { ImportedMarkdownThemeMetadata } from '../types';
import { MAX_IMPORTED_THEME_CSS_BYTES } from './constants';
import { inlineRelativeThemeCssImports } from './cssImports';
import { getThemeAssetDirPath, getThemeCssPath } from './paths';
import { rewriteImportedThemeAssetUrls } from './themeAssets';

const textEncoder = new TextEncoder();

function getCssByteLength(css: string): number {
  return textEncoder.encode(css).byteLength;
}

function isCacheableImportedThemeCss(css: string): boolean {
  return getCssByteLength(css) <= MAX_IMPORTED_THEME_CSS_BYTES;
}

function truncateUtf8Css(css: string, maxBytes: number): string {
  let usedBytes = 0;
  let end = 0;

  for (const char of css) {
    const byteLength = textEncoder.encode(char).byteLength;
    if (usedBytes + byteLength > maxBytes) {
      break;
    }
    usedBytes += byteLength;
    end += char.length;
  }

  return css.slice(0, end);
}

export async function sanitizeImportedCss(
  css: string,
  themeId: string,
  sourcePath?: string | null
): Promise<string> {
  const sanitizedBaseCss = sanitizeImportedMarkdownThemeCss(css);
  const cssWithLocalImports = await inlineRelativeThemeCssImports(css, sourcePath);
  const sanitizedWithImports = sanitizeImportedMarkdownThemeCss(cssWithLocalImports);
  if (isCacheableImportedThemeCss(sanitizedWithImports)) {
    const rewrittenWithImports = await rewriteImportedThemeAssetUrls(sanitizedWithImports, themeId, sourcePath);
    if (isCacheableImportedThemeCss(rewrittenWithImports)) {
      return rewrittenWithImports;
    }
  }

  const rewrittenBaseCss = await rewriteImportedThemeAssetUrls(sanitizedBaseCss, themeId, sourcePath);
  if (isCacheableImportedThemeCss(rewrittenBaseCss)) {
    return rewrittenBaseCss;
  }

  if (isCacheableImportedThemeCss(sanitizedBaseCss)) {
    return sanitizedBaseCss;
  }

  return truncateUtf8Css(sanitizedBaseCss, MAX_IMPORTED_THEME_CSS_BYTES);
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
