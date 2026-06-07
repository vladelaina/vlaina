import {
  getParentPath,
  getStorageAdapter,
  joinPath,
  toFileUrl,
} from '@/lib/storage/adapter';
import {
  rewriteRelativeMarkdownThemeCssUrls,
  type RelativeMarkdownThemeCssUrl,
} from '../cssUrls';
import { sanitizeAssetFilename } from './metadata';
import { getThemeAssetPath } from './paths';

async function resolveOriginalThemeAssetUrl(
  sourceDir: string,
  asset: RelativeMarkdownThemeCssUrl
): Promise<string | null> {
  const sourceAssetPath = await joinPath(sourceDir, asset.path);
  return `${await toFileUrl(sourceAssetPath)}${asset.suffix}`;
}

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
}): Promise<string | null> {
  const sourceAssetPath = await joinPath(sourceDir, asset.path);
  const targetAssetPath = await getThemeAssetPath(themeId, assetFilename);
  const storage = getStorageAdapter();

  try {
    const bytes = await storage.readBinaryFile(sourceAssetPath);
    await storage.writeBinaryFile(targetAssetPath, bytes, { recursive: true });
    return `${await toFileUrl(targetAssetPath)}${asset.suffix}`;
  } catch {
    return resolveOriginalThemeAssetUrl(sourceDir, asset).catch(() => null);
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
      if (!sourceDir) return null;

      const assetFilename = copiedAssetFilenames.get(asset.path)
        ?? sanitizeAssetFilename(asset.path, copiedAssetFilenames.size);
      copiedAssetFilenames.set(asset.path, assetFilename);

      return copyImportedThemeAsset({
        themeId,
        sourceDir,
        asset,
        assetFilename,
      });
    }
  );
}
