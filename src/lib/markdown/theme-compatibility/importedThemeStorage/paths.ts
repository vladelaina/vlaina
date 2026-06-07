import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getStorageBasePath } from '@/lib/storage/basePath';
import { THEME_CACHE_DIR, THEME_INDEX_FILE, USER_THEMES_DIR } from './constants';

async function getVlainaConfigDirPath(): Promise<string> {
  return joinPath(await getStorageBasePath(), '.vlaina');
}

export async function getImportedMarkdownThemesDirectoryPath(): Promise<string> {
  return joinPath(await getVlainaConfigDirPath(), USER_THEMES_DIR);
}

export async function ensureImportedMarkdownThemesDirectory(): Promise<string> {
  const directoryPath = await getImportedMarkdownThemesDirectoryPath();
  await getStorageAdapter().mkdir(directoryPath, true);
  return directoryPath;
}

export async function getThemeCacheDirPath(): Promise<string> {
  return joinPath(await getVlainaConfigDirPath(), THEME_CACHE_DIR);
}

export async function getThemeIndexPath(): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), THEME_INDEX_FILE);
}

export async function getThemeCssPath(cssFile: string): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), cssFile);
}

export async function getThemeAssetDirPath(themeId: string): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), `${themeId}-assets`);
}

export async function getThemeAssetPath(themeId: string, filename: string): Promise<string> {
  return joinPath(await getThemeAssetDirPath(themeId), filename);
}
