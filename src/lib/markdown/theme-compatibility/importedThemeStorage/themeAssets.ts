import {
  getParentPath,
  getStorageAdapter,
  joinPath,
  toFileUrl,
} from '@/lib/storage/adapter';
import {
  rewriteRelativeMarkdownThemeCssUrls,
} from '../cssUrls/rewrite';
import type { RelativeMarkdownThemeCssUrl } from '../cssUrls/types';
import {
  hasInvalidImportedThemeFileSize,
  MAX_IMPORTED_THEME_ASSET_BYTES,
  MAX_IMPORTED_THEME_ASSETS,
} from './constants';
import { normalizeThemeRelativePathInsideDirectory, sanitizeAssetFilename } from './metadata';
import { getThemeAssetPath } from './paths';

async function copyImportedThemeAsset({
  themeId,
  sourceDir,
  asset,
  assetFilename,
}: {
  themeId: string;
  sourceDir: string;
  asset: RelativeMarkdownThemeCssUrl;
  assetFilename: string;
}): Promise<string | false> {
  const sourceAssetPath = await joinPath(sourceDir, asset.path);
  const targetAssetPath = await getThemeAssetPath(themeId, assetFilename);
  const storage = getStorageAdapter();

  try {
    const info = await storage.stat(sourceAssetPath).catch(() => null);
    if (
      info?.isFile === false ||
      info?.isDirectory === true ||
      hasInvalidImportedThemeFileSize(info, MAX_IMPORTED_THEME_ASSET_BYTES)
    ) {
      return false;
    }
    const bytes = await storage.readBinaryFile(sourceAssetPath, MAX_IMPORTED_THEME_ASSET_BYTES);
    if (bytes.byteLength > MAX_IMPORTED_THEME_ASSET_BYTES) {
      return false;
    }
    await storage.writeBinaryFile(targetAssetPath, bytes, { recursive: true });
    return `${await toFileUrl(targetAssetPath)}${asset.suffix}`;
  } catch {
    return false;
  }
}

export async function rewriteImportedThemeAssetUrls(
  css: string,
  themeId: string,
  sourcePath?: string | null
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  const copiedAssetFilenames = new Map<string, string>();

  return rewriteRelativeMarkdownThemeCssUrls(
    css,
    sourcePath,
    async (asset) => {
      if (!sourceDir) return false;
      const safeAssetPath = normalizeThemeRelativePathInsideDirectory(sourceDir, asset.path);
      if (!safeAssetPath) {
        return false;
      }
      const safeAsset = { ...asset, path: safeAssetPath };
      if (copiedAssetFilenames.size >= MAX_IMPORTED_THEME_ASSETS && !copiedAssetFilenames.has(safeAssetPath)) {
        return false;
      }

      const assetFilename = copiedAssetFilenames.get(safeAssetPath)
        ?? sanitizeAssetFilename(safeAssetPath, copiedAssetFilenames.size);
      copiedAssetFilenames.set(safeAssetPath, assetFilename);

      return copyImportedThemeAsset({
        themeId,
        sourceDir,
        asset: safeAsset,
        assetFilename,
      });
    }
  );
}
