import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteImportedMarkdownTheme,
  ensureImportedMarkdownThemesDirectory,
  getImportedMarkdownThemesDirectoryPath,
  importMarkdownThemeCss,
  listImportedMarkdownThemes,
  listImportedMarkdownThemesFromDirectory,
  readImportedMarkdownTheme,
  readImportedMarkdownThemeMetadata,
  syncImportedMarkdownThemesFromDirectory,
} from './importedThemeStorage';
import {
  MAX_IMPORTED_THEME_ASSET_BYTES,
  MAX_IMPORTED_THEME_CSS_BYTES,
  MAX_IMPORTED_THEME_INDEX_BYTES,
} from './importedThemeStorage/constants';

const files = vi.hoisted(() => new Map<string, string>());
const binaryFiles = vi.hoisted(() => new Map<string, Uint8Array>());
const directories = vi.hoisted(() => new Set<string>());
const statFile = vi.hoisted(() => async (path: string) => {
  const text = files.get(path);
  if (text !== undefined) {
    return {
      name: path.split('/').pop() ?? path,
      path,
      isDirectory: false,
      isFile: true,
      size: text.length,
      modifiedAt: 10,
    };
  }
  const bytes = binaryFiles.get(path);
  if (bytes !== undefined) {
    return {
      name: path.split('/').pop() ?? path,
      path,
      isDirectory: false,
      isFile: true,
      size: bytes.byteLength,
      modifiedAt: 10,
    };
  }
  return null;
});
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
  readBinaryFile: vi.fn(async (path: string, maxBytes?: number) => {
    const content = binaryFiles.get(path);
    if (content === undefined) {
      throw new Error(`Missing binary file: ${path}`);
    }
    if (maxBytes !== undefined && content.byteLength > maxBytes) {
      throw new Error(`File is too large to read: ${path}`);
    }
    return content;
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  writeBinaryFile: vi.fn(async (path: string, content: Uint8Array) => {
    binaryFiles.set(path, content);
  }),
  exists: vi.fn(async (path: string) => files.has(path) || binaryFiles.has(path) || directories.has(path)),
  stat: vi.fn(statFile),
  mkdir: vi.fn(async (path: string) => {
    directories.add(path);
  }),
  listDir: vi.fn(async (path: string) => {
    const prefix = `${path}/`;
    return Array.from(files.entries())
      .filter(([filePath]) => filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/'))
      .map(([filePath, content]) => ({
        name: filePath.slice(prefix.length),
        path: filePath,
        isDirectory: false,
        isFile: true,
        size: content.length,
        modifiedAt: 10,
      }));
  }),
  deleteFile: vi.fn(async (path: string) => {
    files.delete(path);
  }),
  deleteDir: vi.fn(async (path: string) => {
    for (const key of Array.from(binaryFiles.keys())) {
      if (key.startsWith(`${path}/`)) {
        binaryFiles.delete(key);
      }
    }
  }),
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

describe('imported markdown theme storage', () => {
  beforeEach(() => {
    files.clear();
    binaryFiles.clear();
    directories.clear();
    vi.clearAllMocks();
    adapter.stat.mockImplementation(statFile);
  });

  it('imports CSS themes into scoped local metadata and sanitizes unsafe CSS entry points', async () => {
    binaryFiles.set('/downloads/fonts/theme.woff2', new Uint8Array([1, 2, 3]));

    const metadata = await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      sourcePath: '/downloads/Clean Light.css',
      css: [
        '@import url("https://example.com/external.css");',
        '@IMPORT "./uppercase.css";',
        '.literal::before { content: "@import url(./literal.css);"; }',
        '/* @import url("./comment.css"); */',
        '#write { color: var(--text-color); }',
        'a { background: url(javascript:alert(1)); }',
        '.local { background: url("file:///tmp/secret.png"); }',
        '@font-face { src: url("./fonts/theme.woff2?version=1#main") format("woff2"); }',
        '.cover { background-image: url(https://example.com/cover.png), url(var(--cover-image)); }',
      ].join('\n'),
    });

    expect(metadata).toMatchObject({
      id: 'clean-light',
      name: 'Clean Light',
      platform: 'typora',
      cssFile: 'clean-light.css',
      sourcePath: '/downloads/Clean Light.css',
    });

    const imported = await readImportedMarkdownTheme('clean-light');
    expect(imported?.css).toContain('#write { color: var(--text-color); }');
    expect(imported?.css).toContain('content: "@import url(./literal.css);"');
    expect(imported?.css).toContain('/* @import url("./comment.css"); */');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).toContain('url("file:///app/.vlaina/app/cache/markdown-themes/clean-light-assets/0-theme.woff2?version=1#main")');
    expect(imported?.css).toContain('url(https://example.com/cover.png)');
    expect(imported?.css).toContain('url(var(--cover-image))');
    expect(binaryFiles.get('/app/.vlaina/app/cache/markdown-themes/clean-light-assets/0-theme.woff2')).toEqual(new Uint8Array([1, 2, 3]));
    expect(imported?.css).not.toContain('@import url("https://example.com/external.css")');
    expect(imported?.css).not.toContain('@IMPORT "./uppercase.css"');
    expect(imported?.css).not.toContain('javascript:alert');
    expect(imported?.css).not.toContain('file:///tmp/secret.png');

    await expect(listImportedMarkdownThemes('typora')).resolves.toEqual([
      expect.objectContaining({ id: 'clean-light', platform: 'typora' }),
    ]);
    await expect(listImportedMarkdownThemes('obsidian')).resolves.toEqual([]);
  });

  it('drops relative theme asset URLs when the asset cannot be copied', async () => {
    await importMarkdownThemeCss({
      name: 'Missing Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/Missing Asset.css',
      css: '.missing { background: url("./images/missing.png"); }',
    });

    const imported = await readImportedMarkdownTheme('missing-asset');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).not.toContain('file:///downloads/images/missing.png');
  });

  it('copies relative theme assets when stat has no size but bounded read succeeds', async () => {
    const assetPath = '/downloads/fonts/no-size.woff2';
    binaryFiles.set(assetPath, new Uint8Array([4, 5, 6]));
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === assetPath) {
        return {
          name: 'no-size.woff2',
          path,
          isDirectory: false,
          isFile: true,
          size: undefined as unknown as number,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    await importMarkdownThemeCss({
      name: 'No Size Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/No Size Asset.css',
      css: '@font-face { src: url("./fonts/no-size.woff2"); }',
    });

    const imported = await readImportedMarkdownTheme('no-size-asset');
    expect(imported?.css).toContain('url("file:///app/.vlaina/app/cache/markdown-themes/no-size-asset-assets/0-no-size.woff2")');
    expect(binaryFiles.get('/app/.vlaina/app/cache/markdown-themes/no-size-asset-assets/0-no-size.woff2')).toEqual(new Uint8Array([4, 5, 6]));
    expect(adapter.readBinaryFile).toHaveBeenCalledWith(assetPath, MAX_IMPORTED_THEME_ASSET_BYTES);
  });

  it('drops oversized relative theme assets instead of falling back to the source path', async () => {
    binaryFiles.set('/downloads/fonts/huge.woff2', new Uint8Array(MAX_IMPORTED_THEME_ASSET_BYTES + 1));

    await importMarkdownThemeCss({
      name: 'Huge Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/Huge Asset.css',
      css: '#write { font-family: huge; } @font-face { src: url("./fonts/huge.woff2"); }',
    });

    const imported = await readImportedMarkdownTheme('huge-asset');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).not.toContain('file:///downloads/fonts/huge.woff2');
    expect(binaryFiles.has('/app/.vlaina/app/cache/markdown-themes/huge-asset-assets/0-huge.woff2')).toBe(false);
  });

  it('drops relative theme assets with invalid stat sizes instead of falling back to the source path', async () => {
    const assetPath = '/downloads/fonts/invalid.woff2';
    binaryFiles.set(assetPath, new Uint8Array([1, 2, 3]));
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === assetPath) {
        return {
          name: 'invalid.woff2',
          path,
          isDirectory: false,
          isFile: true,
          size: -1,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    await importMarkdownThemeCss({
      name: 'Invalid Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/Invalid Asset.css',
      css: '@font-face { src: url("./fonts/invalid.woff2"); }',
    });

    const imported = await readImportedMarkdownTheme('invalid-asset');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).not.toContain('file:///downloads/fonts/invalid.woff2');
    expect(adapter.readBinaryFile).not.toHaveBeenCalledWith(assetPath, MAX_IMPORTED_THEME_ASSET_BYTES);
    expect(binaryFiles.has('/app/.vlaina/app/cache/markdown-themes/invalid-asset-assets/0-invalid.woff2')).toBe(false);
  });

  it('drops relative theme assets when the bounded read rejects them', async () => {
    binaryFiles.set('/downloads/fonts/race.woff2', new Uint8Array(MAX_IMPORTED_THEME_ASSET_BYTES + 1));
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/downloads/fonts/race.woff2') {
        return {
          name: 'race.woff2',
          path,
          isDirectory: false,
          isFile: true,
          size: MAX_IMPORTED_THEME_ASSET_BYTES,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    await importMarkdownThemeCss({
      name: 'Racing Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/Racing Asset.css',
      css: '@font-face { src: url("./fonts/race.woff2"); }',
    });

    const imported = await readImportedMarkdownTheme('racing-asset');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).not.toContain('file:///downloads/fonts/race.woff2');
    expect(adapter.readBinaryFile).toHaveBeenCalledWith(
      '/downloads/fonts/race.woff2',
      MAX_IMPORTED_THEME_ASSET_BYTES,
    );
    expect(binaryFiles.has('/app/.vlaina/app/cache/markdown-themes/racing-asset-assets/0-race.woff2')).toBe(false);
  });

  it('detects the source theme platform when importing CSS without a manual compatibility choice', async () => {
    const metadata = await importMarkdownThemeCss({
      name: 'Minimal.css',
      css: [
        'body.theme-dark { --background-primary: #111; }',
        '.markdown-preview-view { color: var(--text-normal); }',
      ].join('\n'),
    });

    expect(metadata).toMatchObject({
      id: 'minimal',
      platform: 'obsidian',
    });
    await expect(listImportedMarkdownThemes('obsidian')).resolves.toEqual([
      expect.objectContaining({ id: 'minimal', platform: 'obsidian' }),
    ]);
  });

  it('reads imported theme metadata without reading the cached CSS body', async () => {
    await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    adapter.readFile.mockClear();

    await expect(readImportedMarkdownThemeMetadata('clean-light')).resolves.toEqual(expect.objectContaining({
      id: 'clean-light',
      platform: 'typora',
      cssFile: 'clean-light.css',
    }));

    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/themes.json',
      MAX_IMPORTED_THEME_INDEX_BYTES,
    );
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/clean-light.css');
  });

  it('reads imported theme indexes when stat has no size', async () => {
    await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/cache/markdown-themes/themes.json') {
        return {
          name: 'themes.json',
          path,
          isDirectory: false,
          isFile: true,
          size: undefined as unknown as number,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });
    adapter.readFile.mockClear();

    await expect(listImportedMarkdownThemes('typora')).resolves.toEqual([
      expect.objectContaining({ id: 'clean-light', platform: 'typora' }),
    ]);
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/themes.json',
      MAX_IMPORTED_THEME_INDEX_BYTES,
    );
  });

  it('does not read imported theme indexes with invalid known stat sizes', async () => {
    await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/cache/markdown-themes/themes.json') {
        return {
          name: 'themes.json',
          path,
          isDirectory: false,
          isFile: true,
          size: -1,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });
    adapter.readFile.mockClear();

    await expect(listImportedMarkdownThemes('typora')).resolves.toEqual([]);
    expect(adapter.readFile).not.toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/themes.json',
      MAX_IMPORTED_THEME_INDEX_BYTES,
    );
  });

  it('reads cached imported theme CSS when stat has no size', async () => {
    await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/cache/markdown-themes/clean-light.css') {
        return {
          name: 'clean-light.css',
          path,
          isDirectory: false,
          isFile: true,
          size: undefined as unknown as number,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });
    adapter.readFile.mockClear();

    await expect(readImportedMarkdownTheme('clean-light')).resolves.toEqual(expect.objectContaining({
      id: 'clean-light',
      css: expect.stringContaining('#write'),
    }));
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/clean-light.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
  });

  it('does not read cached imported theme CSS with invalid known stat sizes', async () => {
    await importMarkdownThemeCss({
      name: 'Clean Light.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/cache/markdown-themes/clean-light.css') {
        return {
          name: 'clean-light.css',
          path,
          isDirectory: false,
          isFile: true,
          size: -1,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });
    adapter.readFile.mockClear();

    await expect(readImportedMarkdownTheme('clean-light')).resolves.toBeNull();
    expect(adapter.readFile).not.toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/clean-light.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
  });

  it('does not read oversized imported theme indexes', async () => {
    files.set('/app/.vlaina/app/cache/markdown-themes/themes.json', 'x'.repeat(MAX_IMPORTED_THEME_INDEX_BYTES + 1));

    await expect(listImportedMarkdownThemes()).resolves.toEqual([]);

    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/themes.json');
  });

  it('does not read oversized cached imported theme CSS bodies', async () => {
    await importMarkdownThemeCss({
      name: 'Huge Cached.css',
      platform: 'typora',
      css: '#write { color: red; }',
    });
    files.set('/app/.vlaina/app/cache/markdown-themes/huge-cached.css', 'x'.repeat(MAX_IMPORTED_THEME_CSS_BYTES + 1));
    adapter.readFile.mockClear();

    await expect(readImportedMarkdownTheme('huge-cached')).resolves.toBeNull();

    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/cache/markdown-themes/themes.json',
      MAX_IMPORTED_THEME_INDEX_BYTES,
    );
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/huge-cached.css');
  });

  it('deduplicates theme ids and deletes index and CSS entries together', async () => {
    const first = await importMarkdownThemeCss({
      name: 'Minimal.css',
      platform: 'obsidian',
      css: 'body.theme-dark { --background-primary: #111; }',
    });
    const second = await importMarkdownThemeCss({
      name: 'Minimal.css',
      platform: 'obsidian',
      css: 'body.theme-light { --background-primary: #fff; }',
    });

    expect(first.id).toBe('minimal');
    expect(second.id).toBe('minimal-2');
    expect(await listImportedMarkdownThemes('obsidian')).toHaveLength(2);

    await deleteImportedMarkdownTheme('minimal');

    expect(await readImportedMarkdownTheme('minimal')).toBeNull();
    expect(adapter.deleteDir).toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/minimal-assets', true);
    await expect(listImportedMarkdownThemes('obsidian')).resolves.toEqual([
      expect.objectContaining({ id: 'minimal-2' }),
    ]);
  });

  it('exposes the fixed user markdown theme directory inside app configuration', async () => {
    await expect(getImportedMarkdownThemesDirectoryPath()).resolves.toBe('/app/.vlaina/app/themes');
  });

  it('ensures the fixed user markdown theme directory exists on demand', async () => {
    await expect(ensureImportedMarkdownThemesDirectory()).resolves.toBe('/app/.vlaina/app/themes');

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/app/themes', true);
    expect(directories.has('/app/.vlaina/app/themes')).toBe(true);
  });

  it('syncs CSS files from the fixed theme directory and selects the newest source theme', async () => {
    files.set('/app/.vlaina/app/themes/clean-light.css', '#write { color: red; }');
    files.set('/app/.vlaina/app/themes/minimal.css', [
      'body.theme-dark { --background-primary: #111; }',
      '.markdown-preview-view { color: var(--text-normal); }',
    ].join('\n'));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/app/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
      {
        name: 'minimal.css',
        path: '/app/.vlaina/app/themes/minimal.css',
        isDirectory: false,
        isFile: true,
        size: 100,
        modifiedAt: 20,
      },
      {
        name: 'notes.md',
        path: '/app/.vlaina/app/themes/notes.md',
        isDirectory: false,
        isFile: true,
        size: 1,
        modifiedAt: 30,
      },
    ]);
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/minimal.css') {
        return {
          name: 'minimal.css',
          path,
          isDirectory: false,
          isFile: true,
          size: 100,
          modifiedAt: 20,
        };
      }
      return statFile(path);
    });

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/app/themes', true);
    expect(result.directoryPath).toBe('/app/.vlaina/app/themes');
    expect(result.activeThemeId).toBe('minimal');
    await expect(listImportedMarkdownThemes()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'minimal',
        platform: 'obsidian',
        sourcePath: '/app/.vlaina/app/themes/minimal.css',
        sourceModifiedAt: 20,
        sourceSize: 100,
      }),
      expect.objectContaining({
        id: 'clean-light',
        platform: 'typora',
        sourcePath: '/app/.vlaina/app/themes/clean-light.css',
        sourceModifiedAt: 10,
        sourceSize: 22,
      }),
    ]));
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/minimal.css')).toContain('.markdown-preview-view');
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/clean-light.css')).toContain('#write');
  });

  it('skips oversized CSS files while syncing directory themes', async () => {
    files.set('/app/.vlaina/app/themes/huge.css', `${'#write { color: red; }\n'}${'x'.repeat(MAX_IMPORTED_THEME_CSS_BYTES + 1)}`);
    files.set('/app/.vlaina/app/themes/small.css', '#write { color: blue; }');
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'huge.css',
        path: '/app/.vlaina/app/themes/huge.css',
        isDirectory: false,
        isFile: true,
        size: MAX_IMPORTED_THEME_CSS_BYTES + 100,
        modifiedAt: 20,
      },
      {
        name: 'small.css',
        path: '/app/.vlaina/app/themes/small.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes.map((theme) => theme.id)).toEqual(['small']);
    expect(await readImportedMarkdownTheme('huge')).toBeNull();
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/small.css')).toContain('blue');
  });

  it('skips CSS files with invalid known directory entry sizes while syncing themes', async () => {
    files.set('/app/.vlaina/app/themes/invalid-size.css', '#write { color: red; }');
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'invalid-size.css',
        path: '/app/.vlaina/app/themes/invalid-size.css',
        isDirectory: false,
        isFile: true,
        size: -1,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([]);
    expect(adapter.readFile).not.toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/invalid-size.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
    expect(await readImportedMarkdownTheme('invalid-size')).toBeNull();
  });

  it('stats CSS files without directory entry sizes before syncing themes', async () => {
    files.set('/app/.vlaina/app/themes/unknown-size.css', '#write { color: red; }');
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'unknown-size.css',
        path: '/app/.vlaina/app/themes/unknown-size.css',
        isDirectory: false,
        isFile: true,
        size: undefined as unknown as number,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([
      expect.objectContaining({
        id: 'unknown-size',
        sourceModifiedAt: 10,
        sourceSize: 22,
      }),
    ]);
    expect(adapter.stat).toHaveBeenCalledWith('/app/.vlaina/app/themes/unknown-size.css');
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/unknown-size.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
    expect(await readImportedMarkdownTheme('unknown-size')).toEqual(expect.objectContaining({
      id: 'unknown-size',
      css: expect.stringContaining('#write'),
    }));
  });

  it('normalizes invalid CSS stat modified times while syncing themes', async () => {
    files.set('/app/.vlaina/app/themes/invalid-mtime.css', '#write { color: red; }');
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'invalid-mtime.css',
        path: '/app/.vlaina/app/themes/invalid-mtime.css',
        isDirectory: false,
        isFile: true,
        size: undefined as unknown as number,
        modifiedAt: 10,
      },
    ]);
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/invalid-mtime.css') {
        return {
          name: 'invalid-mtime.css',
          path,
          isDirectory: false,
          isFile: true,
          size: 22,
          modifiedAt: Number.POSITIVE_INFINITY,
        };
      }
      return statFile(path);
    });

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([
      expect.objectContaining({
        id: 'invalid-mtime',
        sourceModifiedAt: null,
        sourceSize: 22,
      }),
    ]);
    expect(result.activeThemeId).toBe('invalid-mtime');
  });

  it('syncs CSS files when stat omits size but bounded read succeeds', async () => {
    files.set('/app/.vlaina/app/themes/no-stat-size.css', '#write { color: red; }');
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'no-stat-size.css',
        path: '/app/.vlaina/app/themes/no-stat-size.css',
        isDirectory: false,
        isFile: true,
        size: undefined as unknown as number,
        modifiedAt: 10,
      },
    ]);
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/no-stat-size.css') {
        return {
          name: 'no-stat-size.css',
          path,
          isDirectory: false,
          isFile: true,
          size: undefined as unknown as number,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([
      expect.objectContaining({
        id: 'no-stat-size',
        sourceModifiedAt: 10,
        sourceSize: null,
      }),
    ]);
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/no-stat-size.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
    expect(await readImportedMarkdownTheme('no-stat-size')).toEqual(expect.objectContaining({
      id: 'no-stat-size',
      css: expect.stringContaining('#write'),
    }));
  });

  it('skips CSS files whose stat size is too large when directory size is missing', async () => {
    files.set('/app/.vlaina/app/themes/huge-stat.css', '#write { color: red; }');
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/huge-stat.css') {
        return {
          name: 'huge-stat.css',
          path,
          isDirectory: false,
          isFile: true,
          size: MAX_IMPORTED_THEME_CSS_BYTES + 1,
          modifiedAt: 10,
        };
      }
      const text = files.get(path);
      if (text !== undefined) {
        return {
          name: path.split('/').pop() ?? path,
          path,
          isDirectory: false,
          isFile: true,
          size: text.length,
          modifiedAt: 10,
        };
      }
      return null;
    });
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'huge-stat.css',
        path: '/app/.vlaina/app/themes/huge-stat.css',
        isDirectory: false,
        isFile: true,
        size: undefined as unknown as number,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([]);
    expect(adapter.stat).toHaveBeenCalledWith('/app/.vlaina/app/themes/huge-stat.css');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/huge-stat.css');
    expect(await readImportedMarkdownTheme('huge-stat')).toBeNull();
  });

  it('rechecks directory theme CSS size with stat before reading it', async () => {
    files.set('/app/.vlaina/app/themes/huge.css', `${'#write { color: red; }\n'}${'x'.repeat(MAX_IMPORTED_THEME_CSS_BYTES + 1)}`);
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'huge.css',
        path: '/app/.vlaina/app/themes/huge.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/huge.css') {
        return {
          name: 'huge.css',
          path,
          isDirectory: false,
          isFile: true,
          size: MAX_IMPORTED_THEME_CSS_BYTES + 1,
          modifiedAt: 20,
        };
      }
      const text = files.get(path);
      if (text !== undefined) {
        return {
          name: path.split('/').pop() ?? path,
          path,
          isDirectory: false,
          isFile: true,
          size: text.length,
          modifiedAt: 10,
        };
      }
      return null;
    });

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([]);
    expect(adapter.stat).toHaveBeenCalledWith('/app/.vlaina/app/themes/huge.css');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/huge.css');
    expect(await readImportedMarkdownTheme('huge')).toBeNull();
  });

  it('ignores pure font helper CSS when syncing directory themes', async () => {
    files.set('/app/.vlaina/app/themes/vlook-fancy.css', [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write { color: var(--text-color); }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/vlook/pages-dev/fs-ink-min.css', [
      '@font-face { font-family: "VLOOK"; src: url("./vlook.woff2") format("woff2"); }',
      '@font-face { font-family: "VLOOK Mono"; src: url("./mono.woff2") format("woff2"); }',
    ].join('\n'));
    binaryFiles.set('/app/.vlaina/app/themes/vlook/pages-dev/vlook.woff2', new Uint8Array([1, 2, 3]));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'vlook-fancy.css',
        path: '/app/.vlaina/app/themes/vlook-fancy.css',
        isDirectory: false,
        isFile: true,
        size: 120,
        modifiedAt: 10,
      },
      {
        name: 'fs-ink-min.css',
        path: '/app/.vlaina/app/themes/fs-ink-min.css',
        isDirectory: false,
        isFile: true,
        size: 180,
        modifiedAt: 30,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBe('vlook-fancy');
    await expect(listImportedMarkdownThemes()).resolves.toEqual([
      expect.objectContaining({
        id: 'vlook-fancy',
        platform: 'typora',
        sourcePath: '/app/.vlaina/app/themes/vlook-fancy.css',
      }),
    ]);
    expect(await readImportedMarkdownTheme('fs-ink-min')).toBeNull();
    expect(files.has('/app/.vlaina/app/cache/markdown-themes/fs-ink-min.css')).toBe(false);
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).toContain('font-family: "VLOOK"');
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).toContain(
      'url("file:///app/.vlaina/app/cache/markdown-themes/vlook-fancy-assets/0-vlook.woff2")'
    );
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).not.toContain(
      'file:///app/.vlaina/app/themes/vlook/pages-dev'
    );
    expect(binaryFiles.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy-assets/0-vlook.woff2')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('skips missing relative CSS imports without reading them', async () => {
    files.set('/app/.vlaina/app/themes/vlook-fancy.css', [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      '@import "vlook/github-io/fs-ink-min.css";',
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write { color: var(--text-color); }',
    ].join('\n'));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'vlook-fancy.css',
        path: '/app/.vlaina/app/themes/vlook-fancy.css',
        isDirectory: false,
        isFile: true,
        size: 160,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBe('vlook-fancy');
    expect(adapter.exists).toHaveBeenCalledWith('/app/.vlaina/app/themes/vlook/pages-dev/fs-ink-min.css');
    expect(adapter.exists).toHaveBeenCalledWith('/app/.vlaina/app/themes/vlook/github-io/fs-ink-min.css');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/vlook/pages-dev/fs-ink-min.css', MAX_IMPORTED_THEME_CSS_BYTES);
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/vlook/github-io/fs-ink-min.css', MAX_IMPORTED_THEME_CSS_BYTES);
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).toContain('#write { color: var(--text-color); }');
  });

  it('lists only themes currently sourced from the fixed theme directory for settings dropdowns', async () => {
    await importMarkdownThemeCss({
      name: 'Historical Obsidian.css',
      platform: 'obsidian',
      sourcePath: '/downloads/Historical Obsidian.css',
      css: 'body.theme-dark { --background-primary: #111; }',
    });

    files.set('/app/.vlaina/app/themes/vlook-fancy.css', [
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write { color: var(--text-color); }',
    ].join('\n'));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'vlook-fancy.css',
        path: '/app/.vlaina/app/themes/vlook-fancy.css',
        isDirectory: false,
        isFile: true,
        size: 90,
        modifiedAt: 10,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.themes).toEqual([
      expect.objectContaining({
        id: 'vlook-fancy',
        sourcePath: '/app/.vlaina/app/themes/vlook-fancy.css',
      }),
    ]);
    await expect(listImportedMarkdownThemesFromDirectory()).resolves.toEqual([
      expect.objectContaining({
        id: 'vlook-fancy',
        sourcePath: '/app/.vlaina/app/themes/vlook-fancy.css',
      }),
    ]);
    await expect(listImportedMarkdownThemes()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'historical-obsidian' }),
      expect.objectContaining({ id: 'vlook-fancy' }),
    ]));
  });

  it('removes a synced directory entry when its CSS becomes a pure helper file', async () => {
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'maybe-theme.css',
        path: '/app/.vlaina/app/themes/maybe-theme.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);
    files.set('/app/.vlaina/app/themes/maybe-theme.css', '#write { color: red; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(await readImportedMarkdownTheme('maybe-theme')).toEqual(expect.objectContaining({
      id: 'maybe-theme',
    }));

    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'maybe-theme.css',
        path: '/app/.vlaina/app/themes/maybe-theme.css',
        isDirectory: false,
        isFile: true,
        size: 90,
        modifiedAt: 20,
      },
    ]);
    files.set(
      '/app/.vlaina/app/themes/maybe-theme.css',
      '@font-face { font-family: "VLOOK"; src: url("./vlook.woff2") format("woff2"); }'
    );

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBeNull();
    expect(await readImportedMarkdownTheme('maybe-theme')).toBeNull();
    expect(adapter.deleteFile).toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/maybe-theme.css');
  });

  it('refreshes directory themes with local CSS imports even when the entry file signature is unchanged', async () => {
    const entry = {
      name: 'vlook-fancy.css',
      path: '/app/.vlaina/app/themes/vlook-fancy.css',
      isDirectory: false,
      isFile: true,
      size: 120,
      modifiedAt: 10,
    };
    files.set('/app/.vlaina/app/themes/vlook-fancy.css', [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      '#write { color: var(--helper-color); }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/vlook/pages-dev/fs-ink-min.css', ':root { --helper-color: red; }');
    adapter.listDir.mockResolvedValueOnce([entry]);
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).toContain('--helper-color: red');

    files.set('/app/.vlaina/app/themes/vlook/pages-dev/fs-ink-min.css', ':root { --helper-color: blue; }');
    adapter.listDir.mockResolvedValueOnce([entry]);
    await syncImportedMarkdownThemesFromDirectory();

    expect(files.get('/app/.vlaina/app/cache/markdown-themes/vlook-fancy.css')).toContain('--helper-color: blue');
  });

  it('does not inline oversized relative CSS imports', async () => {
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./huge.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/huge.css', `${':root { --huge: 1; }\n'}${'x'.repeat(MAX_IMPORTED_THEME_CSS_BYTES + 1)}`);
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'theme.css',
        path: '/app/.vlaina/app/themes/theme.css',
        isDirectory: false,
        isFile: true,
        size: 50,
        modifiedAt: 10,
      },
    ]);

    await syncImportedMarkdownThemesFromDirectory();

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('#write { color: red; }');
    expect(imported?.css).not.toContain('--huge');
  });

  it('inlines relative CSS imports when stat has no size but bounded read succeeds', async () => {
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./helper.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/helper.css', ':root { --helper-color: blue; }');
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/helper.css') {
        return {
          name: 'helper.css',
          path,
          isDirectory: false,
          isFile: true,
          size: undefined as unknown as number,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    await importMarkdownThemeCss({
      name: 'Theme.css',
      platform: 'typora',
      sourcePath: '/app/.vlaina/app/themes/theme.css',
      css: files.get('/app/.vlaina/app/themes/theme.css') ?? '',
    });

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('--helper-color: blue');
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/helper.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
  });

  it('stops reading relative CSS imports after the combined CSS budget is exhausted', async () => {
    const helperCss = [
      ':root { --helper-color: blue; }',
      'a'.repeat(Math.floor(MAX_IMPORTED_THEME_CSS_BYTES * 0.6)),
    ].join('\n');
    const extraCss = [
      ':root { --extra-color: orange; }',
      'b'.repeat(Math.floor(MAX_IMPORTED_THEME_CSS_BYTES * 0.6)),
    ].join('\n');
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./helper.css";',
      '@import "./extra.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/helper.css', helperCss);
    files.set('/app/.vlaina/app/themes/extra.css', extraCss);

    await importMarkdownThemeCss({
      name: 'Theme.css',
      platform: 'typora',
      sourcePath: '/app/.vlaina/app/themes/theme.css',
      css: files.get('/app/.vlaina/app/themes/theme.css') ?? '',
    });

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('--helper-color: blue');
    expect(imported?.css).toContain('#write { color: red; }');
    expect(imported?.css).not.toContain('--extra-color: orange');
    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/helper.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
    expect(adapter.readFile).not.toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/extra.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
  });

  it('does not read oversized relative CSS imports before skipping them', async () => {
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./huge.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/huge.css', `${':root { --huge: 1; }\n'}${'x'.repeat(MAX_IMPORTED_THEME_CSS_BYTES + 1)}`);
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'theme.css',
        path: '/app/.vlaina/app/themes/theme.css',
        isDirectory: false,
        isFile: true,
        size: 50,
        modifiedAt: 10,
      },
    ]);

    await syncImportedMarkdownThemesFromDirectory();

    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/huge.css');
    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('#write { color: red; }');
    expect(imported?.css).not.toContain('--huge');
  });

  it('does not read relative CSS imports with invalid known stat sizes', async () => {
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./invalid.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/invalid.css', ':root { --invalid: 1; }');
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/app/themes/invalid.css') {
        return {
          name: 'invalid.css',
          path,
          isDirectory: false,
          isFile: true,
          size: -1,
          modifiedAt: 10,
        };
      }
      return statFile(path);
    });

    await importMarkdownThemeCss({
      name: 'Theme.css',
      platform: 'typora',
      sourcePath: '/app/.vlaina/app/themes/theme.css',
      css: files.get('/app/.vlaina/app/themes/theme.css') ?? '',
    });

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('#write { color: red; }');
    expect(imported?.css).not.toContain('--invalid');
    expect(adapter.readFile).not.toHaveBeenCalledWith(
      '/app/.vlaina/app/themes/invalid.css',
      MAX_IMPORTED_THEME_CSS_BYTES,
    );
  });

  it('does not read relative theme imports or assets outside the source directory', async () => {
    files.set('/app/.vlaina/app/themes/nested/theme.css', [
      '@import "../outside.css";',
      '#write { background: url("../secret.woff2"); }',
      '#write .safe { background: url("./safe.woff2"); }',
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/outside.css', ':root { --outside: red; }');
    binaryFiles.set('/app/.vlaina/app/themes/secret.woff2', new Uint8Array([9, 9, 9]));
    binaryFiles.set('/app/.vlaina/app/themes/nested/safe.woff2', new Uint8Array([1, 2, 3]));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'theme.css',
        path: '/app/.vlaina/app/themes/nested/theme.css',
        isDirectory: false,
        isFile: true,
        size: 120,
        modifiedAt: 10,
      },
    ]);

    await syncImportedMarkdownThemesFromDirectory();

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('#write { background: url(""); }');
    expect(imported?.css).toContain(
      'url("file:///app/.vlaina/app/cache/markdown-themes/theme-assets/0-safe.woff2")'
    );
    expect(imported?.css).not.toContain('url("../secret.woff2")');
    expect(imported?.css).not.toContain('--outside');
    expect(imported?.css).not.toContain('file:///app/.vlaina/app/themes/secret.woff2');
    expect(adapter.stat).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../outside.css');
    expect(adapter.stat).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../secret.woff2');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../outside.css');
    expect(adapter.readBinaryFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../secret.woff2');
    expect(binaryFiles.has('/app/.vlaina/app/cache/markdown-themes/theme-assets/0-secret.woff2')).toBe(false);
  });

  it('does not resolve CSS-escaped parent imports or assets outside the source directory', async () => {
    files.set('/app/.vlaina/app/themes/nested/theme.css', [
      String.raw`@import "\2e\2e/outside.css";`,
      String.raw`#write { background: url("\2e\2e/secret.woff2"); }`,
      String.raw`#write .safe { background: url("\2e/safe.woff2"); }`,
    ].join('\n'));
    files.set('/app/.vlaina/app/themes/outside.css', ':root { --outside: red; }');
    binaryFiles.set('/app/.vlaina/app/themes/secret.woff2', new Uint8Array([9, 9, 9]));
    binaryFiles.set('/app/.vlaina/app/themes/nested/safe.woff2', new Uint8Array([1, 2, 3]));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'theme.css',
        path: '/app/.vlaina/app/themes/nested/theme.css',
        isDirectory: false,
        isFile: true,
        size: 120,
        modifiedAt: 10,
      },
    ]);

    await syncImportedMarkdownThemesFromDirectory();

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).toContain(
      'url("file:///app/.vlaina/app/cache/markdown-themes/theme-assets/0-safe.woff2")'
    );
    expect(imported?.css).not.toContain(String.raw`url("\2e\2e/secret.woff2")`);
    expect(imported?.css).not.toContain('--outside');
    expect(imported?.css).not.toContain('file:///app/.vlaina/app/themes/secret.woff2');
    expect(adapter.stat).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../outside.css');
    expect(adapter.stat).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../secret.woff2');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../outside.css');
    expect(adapter.readBinaryFile).not.toHaveBeenCalledWith('/app/.vlaina/app/themes/nested/../secret.woff2');
    expect(binaryFiles.has('/app/.vlaina/app/cache/markdown-themes/theme-assets/0-secret.woff2')).toBe(false);
  });

  it('does not rebase CSS-escaped parent asset paths from inlined imports', async () => {
    files.set('/app/.vlaina/app/themes/theme.css', [
      '@import "./helpers/helper.css";',
      '#write { color: red; }',
    ].join('\n'));
    files.set(
      '/app/.vlaina/app/themes/helpers/helper.css',
      String.raw`:root { --helper-bg: url("\2e\2e/\2e\2e/secret.woff2"); }`
    );

    await importMarkdownThemeCss({
      name: 'Theme.css',
      platform: 'typora',
      sourcePath: '/app/.vlaina/app/themes/theme.css',
      css: files.get('/app/.vlaina/app/themes/theme.css') ?? '',
    });

    const imported = await readImportedMarkdownTheme('theme');
    expect(imported?.css).toContain('url("")');
    expect(imported?.css).not.toContain(String.raw`url("\2e\2e/\2e\2e/secret.woff2")`);
    expect(imported?.css).not.toContain('file:///app/.vlaina/app/themes/helpers');
    expect(imported?.css).not.toContain('file:///app/.vlaina/secret.woff2');
  });

  it('refreshes changed directory themes and removes deleted directory themes', async () => {
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/app/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);
    files.set('/app/.vlaina/app/themes/clean-light.css', '#write { color: red; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/clean-light.css')).toContain('red');

    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/app/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 23,
        modifiedAt: 20,
      },
    ]);
    files.set('/app/.vlaina/app/themes/clean-light.css', '#write { color: blue; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/app/cache/markdown-themes/clean-light.css')).toContain('blue');

    adapter.listDir.mockResolvedValueOnce([]);
    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBeNull();
    expect(await readImportedMarkdownTheme('clean-light')).toBeNull();
    expect(adapter.deleteFile).toHaveBeenCalledWith('/app/.vlaina/app/cache/markdown-themes/clean-light.css');
  });
});
