import {
  getParentPath,
  getStorageAdapter,
  joinPath,
} from '@/lib/storage/adapter';
import {
  getRelativeMarkdownThemeCssImports,
  rebaseRelativeMarkdownThemeCssUrls,
} from '../cssUrls';
import {
  MAX_IMPORTED_THEME_CSS_BYTES,
  MAX_IMPORTED_THEME_CSS_IMPORT_DEPTH,
  MAX_IMPORTED_THEME_CSS_IMPORTS,
} from './constants';
import { isThemeRelativePathInsideDirectory, normalizeThemePath } from './metadata';

export async function inlineRelativeThemeCssImports(
  css: string,
  sourcePath?: string | null,
  seen = new Set<string>(),
  depth = 0,
  remainingImports: { count: number } = { count: MAX_IMPORTED_THEME_CSS_IMPORTS }
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  const normalizedSourcePath = sourcePath ? normalizeThemePath(sourcePath) : null;
  if (
    !sourceDir ||
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
    if (!isThemeRelativePathInsideDirectory(sourceDir, imported.path)) {
      continue;
    }
    const importedPath = await joinPath(sourceDir, imported.path);
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
        typeof info?.size !== 'number' ||
        info.size > MAX_IMPORTED_THEME_CSS_BYTES
      ) {
        continue;
      }
      const importedCss = await storage.readFile(importedPath);
      if (importedCss.length > MAX_IMPORTED_THEME_CSS_BYTES) {
        continue;
      }
      const inlinedImportedCss = await inlineRelativeThemeCssImports(
        importedCss,
        importedPath,
        seen,
        depth + 1,
        remainingImports
      );
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
