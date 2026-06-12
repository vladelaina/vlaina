import { getStorageAdapter, type FileInfo } from '@/lib/storage/adapter';
import { getRelativeMarkdownThemeCssImports } from '../cssUrls';
import { isStandaloneMarkdownThemeCss } from '../platformDetection';
import type { ImportedMarkdownThemeMetadata } from '../types';
import { cachedThemeCssExists, deleteImportedThemeFiles } from './cssAssets';
import {
  getKnownImportedThemeModifiedAt,
  hasInvalidImportedThemeFileSize,
  isKnownImportedThemeFileSizeWithinLimit,
  MAX_IMPORTED_THEME_CSS_BYTES,
  MAX_IMPORTED_THEME_DIRECTORY_CSS_FILES,
} from './constants';
import {
  findThemeBySourcePath,
  getCssThemeEntries,
  getThemeSourceSignature,
  hasThemeSourceSignatureChanged,
  isThemeSourceInsideDirectory,
  normalizeThemePath,
  sortThemes,
} from './metadata';
import { getImportedMarkdownThemesDirectoryPath } from './paths';
import { readThemeIndex, writeThemeIndex } from './themeIndex';
import { upsertImportedMarkdownThemeCss } from './themeRepository';

interface SyncableThemeCssEntry {
  entry: FileInfo;
  stat: FileInfo;
  css: string;
}

const importedThemeDirectoryCssUtf8Encoder = new TextEncoder();

export interface ImportedMarkdownThemesDirectorySyncResult {
  directoryPath: string;
  themes: ImportedMarkdownThemeMetadata[];
  activeThemeId: string | null;
}

function isImportedThemeDirectoryCssWithinReadLimit(css: string): boolean {
  return (
    css.length <= MAX_IMPORTED_THEME_CSS_BYTES &&
    importedThemeDirectoryCssUtf8Encoder.encode(css).length <= MAX_IMPORTED_THEME_CSS_BYTES
  );
}

async function resolveCssThemeEntryInfo(entry: FileInfo): Promise<FileInfo | null> {
  if (typeof entry.size === 'number') {
    return isKnownImportedThemeFileSizeWithinLimit(entry.size, MAX_IMPORTED_THEME_CSS_BYTES) ? entry : null;
  }

  const info = await getStorageAdapter().stat(entry.path).catch(() => null);
  if (
    !info ||
    info.isFile === false ||
    info.isDirectory === true ||
    hasInvalidImportedThemeFileSize(info, MAX_IMPORTED_THEME_CSS_BYTES)
  ) {
    return null;
  }

  return {
    ...entry,
    size: info.size,
    modifiedAt: getKnownImportedThemeModifiedAt(info.modifiedAt) ?? getKnownImportedThemeModifiedAt(entry.modifiedAt),
  };
}

function selectActiveSyncedThemeId(
  entries: FileInfo[],
  themes: ImportedMarkdownThemeMetadata[]
): string | null {
  const selectedEntry = [...entries].sort((a, b) => {
    const modifiedDiff = (getKnownImportedThemeModifiedAt(b.modifiedAt) ?? 0) - (getKnownImportedThemeModifiedAt(a.modifiedAt) ?? 0);
    return modifiedDiff || a.name.localeCompare(b.name);
  })[0];

  if (!selectedEntry) return null;
  return findThemeBySourcePath(themes, selectedEntry.path)?.id ?? null;
}

export async function syncImportedMarkdownThemesFromDirectory(): Promise<ImportedMarkdownThemesDirectorySyncResult> {
  const storage = getStorageAdapter();
  const directoryPath = await getImportedMarkdownThemesDirectoryPath();
  await storage.mkdir(directoryPath, true).catch(() => undefined);

  const existingThemes = await readThemeIndex();
  const entries = await storage.listDir(directoryPath);
  const cssEntries: FileInfo[] = [];
  for (const entry of getCssThemeEntries(entries)) {
    if (cssEntries.length >= MAX_IMPORTED_THEME_DIRECTORY_CSS_FILES) {
      break;
    }
    const resolved = await resolveCssThemeEntryInfo(entry);
    if (resolved) {
      cssEntries.push(resolved);
    }
  }
  const sourcePaths = new Set(cssEntries.map((entry) => normalizeThemePath(entry.path)));
  const ignoredNonThemeSourcePaths = new Set<string>();
  const syncableCssEntries: SyncableThemeCssEntry[] = [];

  for (const entry of cssEntries) {
    let css: string;
    let stat: FileInfo;
    try {
      const statResult = await storage.stat(entry.path).catch(() => null);
      if (
        !statResult ||
        statResult?.isFile === false ||
        statResult?.isDirectory === true ||
        hasInvalidImportedThemeFileSize(statResult, MAX_IMPORTED_THEME_CSS_BYTES)
      ) {
        continue;
      }
      stat = statResult;
      css = await storage.readFile(entry.path, MAX_IMPORTED_THEME_CSS_BYTES);
    } catch {
      continue;
    }
    if (!isImportedThemeDirectoryCssWithinReadLimit(css)) {
      continue;
    }

    if (!isStandaloneMarkdownThemeCss(css)) {
      ignoredNonThemeSourcePaths.add(normalizeThemePath(entry.path));
      continue;
    }

    syncableCssEntries.push({ entry, stat, css });
  }

  const staleDirectoryThemes = existingThemes.filter((theme) =>
    isThemeSourceInsideDirectory(theme, directoryPath) &&
    (
      !theme.sourcePath ||
      !sourcePaths.has(normalizeThemePath(theme.sourcePath)) ||
      ignoredNonThemeSourcePaths.has(normalizeThemePath(theme.sourcePath))
    )
  );
  let nextThemes = existingThemes.filter((theme) =>
    !staleDirectoryThemes.some((stale) => stale.id === theme.id)
  );

  for (const theme of staleDirectoryThemes) {
    await deleteImportedThemeFiles(theme);
  }

  for (const { entry, stat, css } of syncableCssEntries) {
    const existing = findThemeBySourcePath(nextThemes, entry.path);
    const hasCachedCss = existing ? await cachedThemeCssExists(existing) : false;
    const hasLocalCssImports = getRelativeMarkdownThemeCssImports(css).length > 0;
    if (existing && hasCachedCss && !hasThemeSourceSignatureChanged(existing, stat) && !hasLocalCssImports) {
      continue;
    }

    const signature = getThemeSourceSignature(stat);
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
    activeThemeId: selectActiveSyncedThemeId(syncableCssEntries.map(({ stat }) => stat), nextThemes),
  };
}
