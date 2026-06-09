import { getStorageAdapter } from '@/lib/storage/adapter';
import type { ImportedMarkdownThemeMetadata } from '../types';
import { MAX_IMPORTED_THEME_INDEX_BYTES } from './constants';
import { parseThemeIndex, parseThemeMetadata } from './metadata';
import { getThemeIndexPath } from './paths';

interface ImportedMarkdownThemeIndex {
  version: 1;
  themes: ImportedMarkdownThemeMetadata[];
}

export async function readThemeIndex(): Promise<ImportedMarkdownThemeMetadata[]> {
  const storage = getStorageAdapter();
  const indexPath = await getThemeIndexPath();
  try {
    const info = await storage.stat(indexPath).catch(() => null);
    if (
      info?.isFile === false ||
      typeof info?.size !== 'number' ||
      info.size > MAX_IMPORTED_THEME_INDEX_BYTES
    ) {
      return [];
    }
    const content = await storage.readFile(indexPath);
    if (content.length > MAX_IMPORTED_THEME_INDEX_BYTES) {
      return [];
    }
    const parsed: unknown = JSON.parse(content);
    return parseThemeIndex(parsed);
  } catch {
    return [];
  }
}

export async function writeThemeIndex(themes: ImportedMarkdownThemeMetadata[]): Promise<void> {
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
