import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  joinPath,
  normalizePath,
  toFileUrl,
  type FileInfo,
} from '@/lib/storage/adapter';
import { getStorageBasePath } from '@/lib/storage/basePath';
import {
  isMarkdownThemePlatform,
  isSafeImportedMarkdownThemeId,
  normalizeImportedMarkdownThemeId,
  type ImportedMarkdownTheme,
  type ImportedMarkdownThemeMetadata,
  type MarkdownThemePlatform,
} from './types';
import {
  getRelativeMarkdownThemeCssImports,
  rebaseRelativeMarkdownThemeCssUrls,
  rewriteRelativeMarkdownThemeCssUrls,
  sanitizeImportedMarkdownThemeCss,
  type RelativeMarkdownThemeCssUrl,
} from './cssUrls';
import { detectMarkdownThemePlatform, isStandaloneMarkdownThemeCss } from './platformDetection';

const USER_THEMES_DIR = 'themes';
const THEME_CACHE_DIR = 'store/markdown-theme-cache';
const THEME_INDEX_FILE = 'themes.json';
const CSS_EXTENSION = '.css';

interface ImportedMarkdownThemeIndex {
  version: 1;
  themes: ImportedMarkdownThemeMetadata[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCssFilename(id: string): string {
  return `${normalizeImportedMarkdownThemeId(id)}${CSS_EXTENSION}`;
}

function sanitizeAssetFilename(path: string, index: number): string {
  return normalizeImportedMarkdownThemeId(`${index}-${getBaseName(path) || 'asset'}`);
}

function sanitizeThemeName(name: string): string {
  const normalized = name.replace(/\s+/g, ' ').trim();
  return normalized || 'Imported theme';
}

function stripCssExtension(name: string): string {
  return name.toLowerCase().endsWith(CSS_EXTENSION)
    ? name.slice(0, -CSS_EXTENSION.length)
    : name;
}

async function getThemeAssetDirPath(themeId: string): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), `${themeId}-assets`);
}

async function getThemeAssetPath(themeId: string, filename: string): Promise<string> {
  return joinPath(await getThemeAssetDirPath(themeId), filename);
}

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

async function sanitizeImportedCss(
  css: string,
  themeId: string,
  sourcePath?: string | null
): Promise<string> {
  const cssWithLocalImports = await inlineRelativeThemeCssImports(css, sourcePath);
  const sanitized = sanitizeImportedMarkdownThemeCss(cssWithLocalImports);
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  const copiedAssetFilenames = new Map<string, string>();

  return rewriteRelativeMarkdownThemeCssUrls(
    sanitized,
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

async function inlineRelativeThemeCssImports(
  css: string,
  sourcePath?: string | null,
  seen = new Set<string>()
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  const normalizedSourcePath = sourcePath ? normalizeThemePath(sourcePath) : null;
  if (!sourceDir || !normalizedSourcePath || seen.has(normalizedSourcePath)) {
    return css;
  }

  seen.add(normalizedSourcePath);
  const imports = getRelativeMarkdownThemeCssImports(css);
  if (imports.length === 0) {
    return css;
  }

  const importedCssBlocks: string[] = [];
  const storage = getStorageAdapter();

  for (const imported of imports) {
    const importedPath = await joinPath(sourceDir, imported.path);
    const normalizedImportedPath = normalizeThemePath(importedPath);
    if (seen.has(normalizedImportedPath)) {
      continue;
    }

    try {
      const importedCss = await storage.readFile(importedPath);
      const inlinedImportedCss = await inlineRelativeThemeCssImports(importedCss, importedPath, seen);
      importedCssBlocks.push(await rebaseRelativeMarkdownThemeCssUrls(inlinedImportedCss, importedPath));
    } catch {
      continue;
    }
  }

  if (importedCssBlocks.length === 0) {
    return css;
  }

  return `${importedCssBlocks.join('\n')}\n${css}`;
}

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

async function getThemeCacheDirPath(): Promise<string> {
  return joinPath(await getVlainaConfigDirPath(), THEME_CACHE_DIR);
}

async function getThemeIndexPath(): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), THEME_INDEX_FILE);
}

async function getThemeCssPath(cssFile: string): Promise<string> {
  return joinPath(await getThemeCacheDirPath(), cssFile);
}

function parseThemeMetadata(value: unknown): ImportedMarkdownThemeMetadata | null {
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

function parseThemeIndex(value: unknown): ImportedMarkdownThemeMetadata[] {
  if (!isRecord(value) || !Array.isArray(value.themes)) return [];
  return value.themes
    .map(parseThemeMetadata)
    .filter((theme): theme is ImportedMarkdownThemeMetadata => theme !== null);
}

async function readThemeIndex(): Promise<ImportedMarkdownThemeMetadata[]> {
  const storage = getStorageAdapter();
  const indexPath = await getThemeIndexPath();
  try {
    const parsed: unknown = JSON.parse(await storage.readFile(indexPath));
    return parseThemeIndex(parsed);
  } catch {
    return [];
  }
}

async function writeThemeIndex(themes: ImportedMarkdownThemeMetadata[]): Promise<void> {
  const storage = getStorageAdapter();
  const indexPath = await getThemeIndexPath();
  const payload: ImportedMarkdownThemeIndex = {
    version: 1,
    themes: themes
      .map(parseThemeMetadata)
      .filter((theme): theme is ImportedMarkdownThemeMetadata => theme !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  };
  await storage.writeFile(indexPath, JSON.stringify(payload, null, 2), { recursive: true });
}

function resolveUniqueThemeId(name: string, themes: ImportedMarkdownThemeMetadata[]): string {
  const existingIds = new Set(themes.map((theme) => theme.id));
  const baseId = normalizeImportedMarkdownThemeId(stripCssExtension(name));
  if (!existingIds.has(baseId)) return baseId;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const nextId = normalizeImportedMarkdownThemeId(`${baseId}-${suffix}`);
    if (!existingIds.has(nextId)) return nextId;
  }

  return normalizeImportedMarkdownThemeId(`${baseId}-${crypto.randomUUID()}`);
}

function normalizeThemePath(path: string): string {
  return normalizePath(path, true).replace(/\/+$/, '');
}

function isSameThemePath(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && normalizeThemePath(left) === normalizeThemePath(right));
}

function isThemeSourceInsideDirectory(theme: ImportedMarkdownThemeMetadata, directoryPath: string): boolean {
  if (!theme.sourcePath) return false;
  const sourcePath = normalizeThemePath(theme.sourcePath);
  const directory = normalizeThemePath(directoryPath);
  return sourcePath === directory || sourcePath.startsWith(`${directory}/`);
}

function findThemeBySourcePath(
  themes: ImportedMarkdownThemeMetadata[],
  sourcePath: string | null | undefined
): ImportedMarkdownThemeMetadata | null {
  if (!sourcePath) return null;
  return themes.find((theme) => isSameThemePath(theme.sourcePath, sourcePath)) ?? null;
}

function getCssThemeEntries(entries: FileInfo[]): FileInfo[] {
  return entries
    .filter((entry) => entry.isFile && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith(CSS_EXTENSION))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getThemeSourceSignature(entry: FileInfo): {
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

function hasThemeSourceSignatureChanged(
  theme: ImportedMarkdownThemeMetadata,
  entry: FileInfo
): boolean {
  const signature = getThemeSourceSignature(entry);
  return theme.sourceModifiedAt !== signature.sourceModifiedAt || theme.sourceSize !== signature.sourceSize;
}

interface SyncableThemeCssEntry {
  entry: FileInfo;
  css: string;
}

function sortThemes(themes: ImportedMarkdownThemeMetadata[]): ImportedMarkdownThemeMetadata[] {
  return [...themes].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

async function cachedThemeCssExists(theme: ImportedMarkdownThemeMetadata): Promise<boolean> {
  return getStorageAdapter().exists(await getThemeCssPath(theme.cssFile)).catch(() => false);
}

async function deleteImportedThemeFiles(metadata: ImportedMarkdownThemeMetadata): Promise<void> {
  const storage = getStorageAdapter();
  await storage.deleteFile(await getThemeCssPath(metadata.cssFile)).catch(() => undefined);
  await storage.deleteDir(await getThemeAssetDirPath(metadata.id), true).catch(() => undefined);
}

async function writeImportedThemeCss(metadata: ImportedMarkdownThemeMetadata, css: string): Promise<void> {
  await getStorageAdapter().deleteDir(await getThemeAssetDirPath(metadata.id), true).catch(() => undefined);
  await getStorageAdapter().writeFile(
    await getThemeCssPath(metadata.cssFile),
    await sanitizeImportedCss(css, metadata.id, metadata.sourcePath),
    { recursive: true }
  );
}

async function upsertImportedMarkdownThemeCss({
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

function selectActiveSyncedThemeId(
  entries: FileInfo[],
  themes: ImportedMarkdownThemeMetadata[]
): string | null {
  const selectedEntry = [...entries].sort((a, b) => {
    const modifiedDiff = (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0);
    return modifiedDiff || a.name.localeCompare(b.name);
  })[0];

  if (!selectedEntry) return null;
  return findThemeBySourcePath(themes, selectedEntry.path)?.id ?? null;
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

export async function readImportedMarkdownTheme(id: string): Promise<ImportedMarkdownTheme | null> {
  if (!isSafeImportedMarkdownThemeId(id)) return null;
  const themes = await readThemeIndex();
  const metadata = themes.find((theme) => theme.id === id);
  if (!metadata) return null;

  const storage = getStorageAdapter();
  try {
    const css = await storage.readFile(await getThemeCssPath(metadata.cssFile));
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

export interface ImportedMarkdownThemesDirectorySyncResult {
  directoryPath: string;
  themes: ImportedMarkdownThemeMetadata[];
  activeThemeId: string | null;
}

export async function syncImportedMarkdownThemesFromDirectory(): Promise<ImportedMarkdownThemesDirectorySyncResult> {
  const storage = getStorageAdapter();
  const directoryPath = await getImportedMarkdownThemesDirectoryPath();
  await storage.mkdir(directoryPath, true).catch(() => undefined);

  const existingThemes = await readThemeIndex();
  let entries: FileInfo[] = [];

  entries = await storage.listDir(directoryPath);

  const cssEntries = getCssThemeEntries(entries);
  const sourcePaths = new Set(cssEntries.map((entry) => normalizeThemePath(entry.path)));
  const ignoredNonThemeSourcePaths = new Set<string>();
  const syncableCssEntries: SyncableThemeCssEntry[] = [];

  for (const entry of cssEntries) {
    let css: string;
    try {
      css = await storage.readFile(entry.path);
    } catch {
      continue;
    }

    if (!isStandaloneMarkdownThemeCss(css)) {
      ignoredNonThemeSourcePaths.add(normalizeThemePath(entry.path));
      continue;
    }

    syncableCssEntries.push({ entry, css });
  }

  const staleDirectoryThemes = existingThemes.filter((theme) =>
    isThemeSourceInsideDirectory(theme, directoryPath) &&
    (
      !theme.sourcePath ||
      !sourcePaths.has(normalizeThemePath(theme.sourcePath)) ||
      ignoredNonThemeSourcePaths.has(normalizeThemePath(theme.sourcePath))
    )
  );
  let nextThemes = existingThemes.filter((theme) => !staleDirectoryThemes.some((stale) => stale.id === theme.id));

  for (const theme of staleDirectoryThemes) {
    await deleteImportedThemeFiles(theme);
  }

  for (const { entry, css } of syncableCssEntries) {
    const existing = findThemeBySourcePath(nextThemes, entry.path);
    const hasCachedCss = existing ? await cachedThemeCssExists(existing) : false;
    const hasLocalCssImports = getRelativeMarkdownThemeCssImports(css).length > 0;
    if (existing && hasCachedCss && !hasThemeSourceSignatureChanged(existing, entry) && !hasLocalCssImports) {
      continue;
    }

    const signature = getThemeSourceSignature(entry);
    const upserted = await upsertImportedMarkdownThemeCss({
      name: entry.name,
      css,
      sourcePath: entry.path,
      sourceModifiedAt: signature.sourceModifiedAt,
      sourceSize: signature.sourceSize,
      themes: nextThemes,
    });
    nextThemes = upserted.themes;
  }

  await writeThemeIndex(nextThemes);

  return {
    directoryPath,
    themes: sortThemes(nextThemes.filter((theme) => isThemeSourceInsideDirectory(theme, directoryPath))),
    activeThemeId: selectActiveSyncedThemeId(syncableCssEntries.map(({ entry }) => entry), nextThemes),
  };
}
