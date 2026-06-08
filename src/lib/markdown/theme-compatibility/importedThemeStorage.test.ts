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

const files = vi.hoisted(() => new Map<string, string>());
const binaryFiles = vi.hoisted(() => new Map<string, Uint8Array>());
const directories = vi.hoisted(() => new Set<string>());
const adapter = vi.hoisted(() => ({
  readFile: vi.fn(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) {
      throw new Error(`Missing file: ${path}`);
    }
    return content;
  }),
  readBinaryFile: vi.fn(async (path: string) => {
    const content = binaryFiles.get(path);
    if (content === undefined) {
      throw new Error(`Missing binary file: ${path}`);
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
  });

  it('imports CSS themes into scoped local metadata and sanitizes unsafe CSS entry points', async () => {
    binaryFiles.set('/downloads/./fonts/theme.woff2', new Uint8Array([1, 2, 3]));

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
    expect(imported?.css).toContain('url("file:///app/.vlaina/store/markdown-theme-cache/clean-light-assets/0-theme.woff2?version=1#main")');
    expect(imported?.css).toContain('url(https://example.com/cover.png)');
    expect(imported?.css).toContain('url(var(--cover-image))');
    expect(binaryFiles.get('/app/.vlaina/store/markdown-theme-cache/clean-light-assets/0-theme.woff2')).toEqual(new Uint8Array([1, 2, 3]));
    expect(imported?.css).not.toContain('@import url("https://example.com/external.css")');
    expect(imported?.css).not.toContain('@IMPORT "./uppercase.css"');
    expect(imported?.css).not.toContain('javascript:alert');

    await expect(listImportedMarkdownThemes('typora')).resolves.toEqual([
      expect.objectContaining({ id: 'clean-light', platform: 'typora' }),
    ]);
    await expect(listImportedMarkdownThemes('obsidian')).resolves.toEqual([]);
  });

  it('falls back to the original file URL when a relative theme asset cannot be copied', async () => {
    await importMarkdownThemeCss({
      name: 'Missing Asset.css',
      platform: 'typora',
      sourcePath: '/downloads/Missing Asset.css',
      css: '.missing { background: url("./images/missing.png"); }',
    });

    const imported = await readImportedMarkdownTheme('missing-asset');
    expect(imported?.css).toContain('url("file:///downloads/./images/missing.png")');
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

    expect(adapter.readFile).toHaveBeenCalledWith('/app/.vlaina/store/markdown-theme-cache/themes.json');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/app/.vlaina/store/markdown-theme-cache/clean-light.css');
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
    expect(adapter.deleteDir).toHaveBeenCalledWith('/app/.vlaina/store/markdown-theme-cache/minimal-assets', true);
    await expect(listImportedMarkdownThemes('obsidian')).resolves.toEqual([
      expect.objectContaining({ id: 'minimal-2' }),
    ]);
  });

  it('exposes the fixed user markdown theme directory inside app configuration', async () => {
    await expect(getImportedMarkdownThemesDirectoryPath()).resolves.toBe('/app/.vlaina/themes');
  });

  it('ensures the fixed user markdown theme directory exists on demand', async () => {
    await expect(ensureImportedMarkdownThemesDirectory()).resolves.toBe('/app/.vlaina/themes');

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/themes', true);
    expect(directories.has('/app/.vlaina/themes')).toBe(true);
  });

  it('syncs CSS files from the fixed theme directory and selects the newest source theme', async () => {
    files.set('/app/.vlaina/themes/clean-light.css', '#write { color: red; }');
    files.set('/app/.vlaina/themes/minimal.css', [
      'body.theme-dark { --background-primary: #111; }',
      '.markdown-preview-view { color: var(--text-normal); }',
    ].join('\n'));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
      {
        name: 'minimal.css',
        path: '/app/.vlaina/themes/minimal.css',
        isDirectory: false,
        isFile: true,
        size: 100,
        modifiedAt: 20,
      },
      {
        name: 'notes.md',
        path: '/app/.vlaina/themes/notes.md',
        isDirectory: false,
        isFile: true,
        size: 1,
        modifiedAt: 30,
      },
    ]);

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/themes', true);
    expect(result.directoryPath).toBe('/app/.vlaina/themes');
    expect(result.activeThemeId).toBe('minimal');
    await expect(listImportedMarkdownThemes()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'minimal',
        platform: 'obsidian',
        sourcePath: '/app/.vlaina/themes/minimal.css',
        sourceModifiedAt: 20,
        sourceSize: 100,
      }),
      expect.objectContaining({
        id: 'clean-light',
        platform: 'typora',
        sourcePath: '/app/.vlaina/themes/clean-light.css',
        sourceModifiedAt: 10,
        sourceSize: 22,
      }),
    ]));
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/minimal.css')).toContain('.markdown-preview-view');
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/clean-light.css')).toContain('#write');
  });

  it('ignores pure font helper CSS when syncing directory themes', async () => {
    files.set('/app/.vlaina/themes/vlook-fancy.css', [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write { color: var(--text-color); }',
    ].join('\n'));
    files.set('/app/.vlaina/themes/vlook/pages-dev/fs-ink-min.css', [
      '@font-face { font-family: "VLOOK"; src: url("./vlook.woff2") format("woff2"); }',
      '@font-face { font-family: "VLOOK Mono"; src: url("./mono.woff2") format("woff2"); }',
    ].join('\n'));
    binaryFiles.set('/app/.vlaina/themes/vlook/pages-dev/vlook.woff2', new Uint8Array([1, 2, 3]));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'vlook-fancy.css',
        path: '/app/.vlaina/themes/vlook-fancy.css',
        isDirectory: false,
        isFile: true,
        size: 120,
        modifiedAt: 10,
      },
      {
        name: 'fs-ink-min.css',
        path: '/app/.vlaina/themes/fs-ink-min.css',
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
        sourcePath: '/app/.vlaina/themes/vlook-fancy.css',
      }),
    ]);
    expect(await readImportedMarkdownTheme('fs-ink-min')).toBeNull();
    expect(files.has('/app/.vlaina/store/markdown-theme-cache/fs-ink-min.css')).toBe(false);
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/vlook-fancy.css')).toContain('font-family: "VLOOK"');
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/vlook-fancy.css')).toContain(
      'url("file:///app/.vlaina/themes/vlook/pages-dev/./vlook.woff2")'
    );
  });

  it('lists only themes currently sourced from the fixed theme directory for settings dropdowns', async () => {
    await importMarkdownThemeCss({
      name: 'Historical Obsidian.css',
      platform: 'obsidian',
      sourcePath: '/downloads/Historical Obsidian.css',
      css: 'body.theme-dark { --background-primary: #111; }',
    });

    files.set('/app/.vlaina/themes/vlook-fancy.css', [
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write { color: var(--text-color); }',
    ].join('\n'));
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'vlook-fancy.css',
        path: '/app/.vlaina/themes/vlook-fancy.css',
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
        sourcePath: '/app/.vlaina/themes/vlook-fancy.css',
      }),
    ]);
    await expect(listImportedMarkdownThemesFromDirectory()).resolves.toEqual([
      expect.objectContaining({
        id: 'vlook-fancy',
        sourcePath: '/app/.vlaina/themes/vlook-fancy.css',
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
        path: '/app/.vlaina/themes/maybe-theme.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);
    files.set('/app/.vlaina/themes/maybe-theme.css', '#write { color: red; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(await readImportedMarkdownTheme('maybe-theme')).toEqual(expect.objectContaining({
      id: 'maybe-theme',
    }));

    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'maybe-theme.css',
        path: '/app/.vlaina/themes/maybe-theme.css',
        isDirectory: false,
        isFile: true,
        size: 90,
        modifiedAt: 20,
      },
    ]);
    files.set(
      '/app/.vlaina/themes/maybe-theme.css',
      '@font-face { font-family: "VLOOK"; src: url("./vlook.woff2") format("woff2"); }'
    );

    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBeNull();
    expect(await readImportedMarkdownTheme('maybe-theme')).toBeNull();
    expect(adapter.deleteFile).toHaveBeenCalledWith('/app/.vlaina/store/markdown-theme-cache/maybe-theme.css');
  });

  it('refreshes directory themes with local CSS imports even when the entry file signature is unchanged', async () => {
    const entry = {
      name: 'vlook-fancy.css',
      path: '/app/.vlaina/themes/vlook-fancy.css',
      isDirectory: false,
      isFile: true,
      size: 120,
      modifiedAt: 10,
    };
    files.set('/app/.vlaina/themes/vlook-fancy.css', [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      '#write { color: var(--helper-color); }',
    ].join('\n'));
    files.set('/app/.vlaina/themes/vlook/pages-dev/fs-ink-min.css', ':root { --helper-color: red; }');
    adapter.listDir.mockResolvedValueOnce([entry]);
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/vlook-fancy.css')).toContain('--helper-color: red');

    files.set('/app/.vlaina/themes/vlook/pages-dev/fs-ink-min.css', ':root { --helper-color: blue; }');
    adapter.listDir.mockResolvedValueOnce([entry]);
    await syncImportedMarkdownThemesFromDirectory();

    expect(files.get('/app/.vlaina/store/markdown-theme-cache/vlook-fancy.css')).toContain('--helper-color: blue');
  });

  it('refreshes changed directory themes and removes deleted directory themes', async () => {
    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 22,
        modifiedAt: 10,
      },
    ]);
    files.set('/app/.vlaina/themes/clean-light.css', '#write { color: red; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/clean-light.css')).toContain('red');

    adapter.listDir.mockResolvedValueOnce([
      {
        name: 'clean-light.css',
        path: '/app/.vlaina/themes/clean-light.css',
        isDirectory: false,
        isFile: true,
        size: 23,
        modifiedAt: 20,
      },
    ]);
    files.set('/app/.vlaina/themes/clean-light.css', '#write { color: blue; }');
    await syncImportedMarkdownThemesFromDirectory();
    expect(files.get('/app/.vlaina/store/markdown-theme-cache/clean-light.css')).toContain('blue');

    adapter.listDir.mockResolvedValueOnce([]);
    const result = await syncImportedMarkdownThemesFromDirectory();

    expect(result.activeThemeId).toBeNull();
    expect(await readImportedMarkdownTheme('clean-light')).toBeNull();
    expect(adapter.deleteFile).toHaveBeenCalledWith('/app/.vlaina/store/markdown-theme-cache/clean-light.css');
  });
});
