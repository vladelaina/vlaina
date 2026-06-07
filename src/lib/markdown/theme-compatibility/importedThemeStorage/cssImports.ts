import {
  getParentPath,
  getStorageAdapter,
  joinPath,
} from '@/lib/storage/adapter';
import {
  getRelativeMarkdownThemeCssImports,
  rebaseRelativeMarkdownThemeCssUrls,
} from '../cssUrls';
import { normalizeThemePath } from './metadata';

export async function inlineRelativeThemeCssImports(
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
