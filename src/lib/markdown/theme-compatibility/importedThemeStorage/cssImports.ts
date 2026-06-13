import {
  getParentPath,
  getStorageAdapter,
  joinPath,
  relativePath,
} from '@/lib/storage/adapter';
import {
  getRelativeMarkdownThemeCssImports,
  rewriteRelativeMarkdownThemeCssUrls,
} from '../cssUrls';
import {
  hasInvalidImportedThemeFileSize,
  MAX_IMPORTED_THEME_CSS_BYTES,
  MAX_IMPORTED_THEME_CSS_IMPORT_DEPTH,
  MAX_IMPORTED_THEME_CSS_IMPORTS,
} from './constants';
import {
  normalizeThemePath,
  normalizeThemeRelativePathInsideDirectory,
} from './metadata';

const importedThemeCssImportUtf8Encoder = new TextEncoder();

function isImportedThemeCssWithinReadLimit(css: string): boolean {
  return importedThemeCssImportUtf8Encoder.encode(css).byteLength <= MAX_IMPORTED_THEME_CSS_BYTES;
}

async function rebaseImportedThemeCssUrls(
  css: string,
  sourcePath: string,
  rootSourceDir: string
): Promise<string> {
  const sourceDir = getParentPath(sourcePath);
  if (!sourceDir) {
    return css;
  }

  return rewriteRelativeMarkdownThemeCssUrls(css, sourcePath, async ({ path, suffix }) => {
    const safeAssetPath = normalizeThemeRelativePathInsideDirectory(sourceDir, path);
    if (!safeAssetPath) {
      return false;
    }

    const assetPath = await joinPath(sourceDir, safeAssetPath);
    const rebasedAssetPath = relativePath(rootSourceDir, assetPath);
    if (!normalizeThemeRelativePathInsideDirectory(rootSourceDir, rebasedAssetPath)) {
      return false;
    }
    return `${rebasedAssetPath}${suffix}`;
  });
}

export async function inlineRelativeThemeCssImports(
  css: string,
  sourcePath?: string | null,
  seen = new Set<string>(),
  depth = 0,
  remainingImports: { count: number } = { count: MAX_IMPORTED_THEME_CSS_IMPORTS },
  rootSourceDir?: string
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  const normalizedSourcePath = sourcePath ? normalizeThemePath(sourcePath) : null;
  const importRootSourceDir = rootSourceDir ?? sourceDir ?? undefined;
  if (
    !sourceDir ||
    !importRootSourceDir ||
    !normalizedSourcePath ||
    seen.has(normalizedSourcePath) ||
    depth >= MAX_IMPORTED_THEME_CSS_IMPORT_DEPTH ||
    remainingImports.count <= 0
  ) {
    return css;
  }

  seen.add(normalizedSourcePath);
  const imports = getRelativeMarkdownThemeCssImports(css).slice(0, remainingImports.count);
  if (imports.length === 0) {
    return css;
  }

  const importedCssBlocks: string[] = [];
  const storage = getStorageAdapter();

  for (const imported of imports) {
    const safeImportedPath = normalizeThemeRelativePathInsideDirectory(sourceDir, imported.path);
    if (!safeImportedPath) {
      continue;
    }
    const importedPath = await joinPath(sourceDir, safeImportedPath);
    const normalizedImportedPath = normalizeThemePath(importedPath);
    if (seen.has(normalizedImportedPath)) {
      continue;
    }
    if (remainingImports.count <= 0) {
      break;
    }
    remainingImports.count -= 1;

    try {
      const info = await storage.stat(importedPath).catch(() => null);
      if (
        info?.isFile === false ||
        info?.isDirectory === true ||
        hasInvalidImportedThemeFileSize(info, MAX_IMPORTED_THEME_CSS_BYTES)
      ) {
        continue;
      }
      const importedCss = await storage.readFile(importedPath, MAX_IMPORTED_THEME_CSS_BYTES);
      if (!isImportedThemeCssWithinReadLimit(importedCss)) {
        continue;
      }
      const inlinedImportedCss = await inlineRelativeThemeCssImports(
        importedCss,
        importedPath,
        seen,
        depth + 1,
        remainingImports,
        importRootSourceDir
      );
      importedCssBlocks.push(await rebaseImportedThemeCssUrls(
        inlinedImportedCss,
        importedPath,
        importRootSourceDir
      ));
    } catch {
      continue;
    }
  }

  if (importedCssBlocks.length === 0) {
    return css;
  }

  return `${importedCssBlocks.join('\n')}\n${css}`;
}
