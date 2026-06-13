import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importMarkdownThemeCss,
  readImportedMarkdownTheme,
} from './importedThemeStorage';
import { MAX_IMPORTED_THEME_CSS_BYTES } from './importedThemeStorage/constants';

const files = vi.hoisted(() => new Map<string, string>());
const textEncoder = new TextEncoder();

const adapter = vi.hoisted(() => ({
  readFile: vi.fn(async (path: string, maxBytes?: number) => {
    const content = files.get(path);
    if (content === undefined) {
      throw new Error(`Missing file: ${path}`);
    }
    if (maxBytes !== undefined && new TextEncoder().encode(content).byteLength > maxBytes) {
      throw new Error(`File is too large to read: ${path}`);
    }
    return content;
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  exists: vi.fn(async (path: string) => files.has(path)),
  stat: vi.fn(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) return null;
    return {
      name: path.split('/').pop() ?? path,
      path,
      isDirectory: false,
      isFile: true,
      size: new TextEncoder().encode(content).byteLength,
      modifiedAt: 10,
    };
  }),
  mkdir: vi.fn(async () => undefined),
  deleteFile: vi.fn(async (path: string) => {
    files.delete(path);
  }),
  deleteDir: vi.fn(async () => undefined),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  getBaseName: (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? '',
  getParentPath: (path: string) => path.replace(/[\\/][^\\/]*$/, '') || null,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
  normalizePath: (path: string) => path.replace(/\\/g, '/'),
  relativePath: (from: string, to: string) => {
    const normalizedFrom = from.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedTo = to.replace(/\\/g, '/');
    return normalizedTo.startsWith(`${normalizedFrom}/`)
      ? normalizedTo.slice(normalizedFrom.length + 1)
      : normalizedTo;
  },
  toFileUrl: (path: string) => Promise.resolve(`file://${path}`),
}));

vi.mock('@/lib/storage/basePath', () => ({
  getStorageBasePath: () => Promise.resolve('/app'),
}));

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

describe('imported markdown theme CSS cache budget', () => {
  beforeEach(() => {
    files.clear();
    vi.clearAllMocks();
  });

  it('keeps cached theme CSS readable when local imports would exceed the cache limit', async () => {
    const helperCss = `:root { --helper: ${'a'.repeat(Math.floor(MAX_IMPORTED_THEME_CSS_BYTES / 2))}; }`;
    files.set('/downloads/./helper-a.css', helperCss);
    files.set('/downloads/./helper-b.css', helperCss);

    await importMarkdownThemeCss({
      name: 'Budget.css',
      platform: 'typora',
      sourcePath: '/downloads/Budget.css',
      css: [
        '@import "./helper-a.css";',
        '@import "./helper-b.css";',
        '#write { color: red; }',
      ].join('\n'),
    });

    const cachedCss = files.get('/app/.vlaina/store/markdown-theme-cache/budget.css') ?? '';
    expect(byteLength(cachedCss)).toBeLessThanOrEqual(MAX_IMPORTED_THEME_CSS_BYTES);
    expect(cachedCss).toContain('#write { color: red; }');
    expect(cachedCss).not.toContain('--helper');
    await expect(readImportedMarkdownTheme('budget')).resolves.toEqual(expect.objectContaining({
      css: cachedCss,
      id: 'budget',
    }));
  });
});
