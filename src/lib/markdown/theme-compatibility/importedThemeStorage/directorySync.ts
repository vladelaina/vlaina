import { getStorageAdapter, type FileInfo } from '@/lib/storage/adapter';
import { getRelativeMarkdownThemeCssImports } from '../cssUrls';
import { isStandaloneMarkdownThemeCss } from '../platformDetection';
import type { ImportedMarkdownThemeMetadata } from '../types';
import { cachedThemeCssExists, deleteImportedThemeFiles } from './cssAssets';
import {
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
  css: string;
}

export interface ImportedMarkdownThemesDirectorySyncResult {
  directoryPath: string;
  themes: ImportedMarkdownThemeMetadata[];
  activeThemeId: string | null;
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

export async function syncImportedMarkdownThemesFromDirectory(): Promise<ImportedMarkdownThemesDirectorySyncResult> {
  const storage = getStorageAdapter();
  const directoryPath = await getImportedMarkdownThemesDirectoryPath();
  await storage.mkdir(directoryPath, true).catch(() => undefined);

  const existingThemes = await readThemeIndex();
  const entries = await storage.listDir(directoryPath);
  const cssEntries = getCssThemeEntries(entries)
    .filter((entry) => typeof entry.size === 'number' && entry.size <= MAX_IMPORTED_THEME_CSS_BYTES)
    .slice(0, MAX_IMPORTED_THEME_DIRECTORY_CSS_FILES);
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
    if (css.length > MAX_IMPORTED_THEME_CSS_BYTES) {
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
  let nextThemes = existingThemes.filter((theme) =>
    !staleDirectoryThemes.some((stale) => stale.id === theme.id)
  );

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
