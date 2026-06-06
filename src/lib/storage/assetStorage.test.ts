import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_GLOBAL_ICON_SCAN_RESULTS,
  deleteGlobalIconAsset,
  saveGlobalAsset,
  scanGlobalIcons,
} from './assetStorage';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  writeBinaryFile: vi.fn<(path: string, content: Uint8Array) => Promise<void>>(),
  deleteFile: vi.fn<(path: string) => Promise<void>>(),
  listDir: vi.fn<() => Promise<Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    modifiedAt?: number;
  }>>>(),
};

vi.mock('./paths', () => ({
  getPaths: () => Promise.resolve({ metadata: '/app/.vlaina' }),
}));

vi.mock('./adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('assetStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.exists.mockResolvedValue(true);
    adapter.mkdir.mockResolvedValue();
    adapter.writeBinaryFile.mockResolvedValue();
    adapter.deleteFile.mockResolvedValue();
  });

  it('rejects non-image custom icon uploads before writing bytes', async () => {
    const file = new File(['hello'], 'secret.md', { type: 'text/markdown' });

    await expect(saveGlobalAsset(file, 'icons')).rejects.toThrow(
      'Only image files can be saved as custom icons.'
    );

    expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects custom icon uploads with spoofed or mismatched image extensions', async () => {
    await expect(saveGlobalAsset(
      new File(['<script></script>'], 'fake.png', { type: 'text/html' }),
      'icons',
    )).rejects.toThrow('Only image files can be saved as custom icons.');
    await expect(saveGlobalAsset(
      new File(['svg'], 'fake.png', { type: 'image/svg+xml' }),
      'icons',
    )).rejects.toThrow('Only image files can be saved as custom icons.');

    expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects oversized custom icon uploads before writing bytes', async () => {
    const file = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    await expect(saveGlobalAsset(file, 'icons')).rejects.toThrow(
      'Custom icon image is too large.'
    );

    expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('filters unsupported and oversized icon files while scanning', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'ok.png', path: '/app/.vlaina/assets/icons/ok.png', isDirectory: false, isFile: true, size: 100, modifiedAt: 1 },
      { name: 'huge.svg', path: '/app/.vlaina/assets/icons/huge.svg', isDirectory: false, isFile: true, size: 11 * 1024 * 1024, modifiedAt: 2 },
      { name: 'secret.md', path: '/app/.vlaina/assets/icons/secret.md', isDirectory: false, isFile: true, size: 100, modifiedAt: 3 },
    ]);

    await expect(scanGlobalIcons()).resolves.toEqual([
      {
        id: '/app/.vlaina/assets/icons/ok.png',
        url: 'img:/app/.vlaina/assets/icons/ok.png',
        name: 'ok.png',
        createdAt: 1,
      },
    ]);
  });

  it('ignores unsafe icon directory entries while scanning', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'ok.png', path: '/app/.vlaina/assets/icons/ok.png', isDirectory: false, isFile: true, size: 100, modifiedAt: 1 },
      { name: '../secret.png', path: '/app/.vlaina/assets/secret.png', isDirectory: false, isFile: true, size: 100, modifiedAt: 2 },
      { name: 'escape.png', path: '/app/.vlaina/assets/icons/../escape.png', isDirectory: false, isFile: true, size: 100, modifiedAt: 3 },
    ]);

    await expect(scanGlobalIcons()).resolves.toEqual([
      {
        id: '/app/.vlaina/assets/icons/ok.png',
        url: 'img:/app/.vlaina/assets/icons/ok.png',
        name: 'ok.png',
        createdAt: 1,
      },
    ]);
  });

  it('bounds custom icon directory scan results', async () => {
    adapter.listDir.mockResolvedValue(Array.from({ length: MAX_GLOBAL_ICON_SCAN_RESULTS + 1 }, (_, index) => ({
      name: `icon-${index}.png`,
      path: `/app/.vlaina/assets/icons/icon-${index}.png`,
      isDirectory: false,
      isFile: true,
      size: 100,
      modifiedAt: index,
    })));

    const icons = await scanGlobalIcons();

    expect(icons).toHaveLength(MAX_GLOBAL_ICON_SCAN_RESULTS);
    expect(icons.at(-1)?.id).toBe(`/app/.vlaina/assets/icons/icon-${MAX_GLOBAL_ICON_SCAN_RESULTS - 1}.png`);
    expect(icons.some((icon) => icon.id.endsWith(`icon-${MAX_GLOBAL_ICON_SCAN_RESULTS}.png`))).toBe(false);
  });

  it('saves supported custom icon uploads when MIME type and extension match', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(0);
    const file = {
      name: 'icon.webp',
      type: 'image/webp',
      size: 3,
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    } as unknown as File;

    try {
      await expect(saveGlobalAsset(file, 'icons')).resolves.toBe('/app/.vlaina/assets/icons/0_icon.webp');

      expect(adapter.writeBinaryFile).toHaveBeenCalledWith(
        '/app/.vlaina/assets/icons/0_icon.webp',
        new Uint8Array([1, 2, 3]),
      );
    } finally {
      dateNow.mockRestore();
    }
  });

  it('sanitizes SVG custom icon uploads before writing bytes', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(0);
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      '<script>alert(1)</script>',
      '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
      '<circle cx="1" cy="1" r="1"></circle>',
      '</svg>',
    ].join('');
    const file = {
      name: 'icon.svg',
      type: 'image/svg+xml',
      size: svg.length,
      arrayBuffer: vi.fn(async () => new TextEncoder().encode(svg).buffer),
    } as unknown as File;

    try {
      await expect(saveGlobalAsset(file, 'icons')).resolves.toBe('/app/.vlaina/assets/icons/0_icon.svg');
      const bytes = adapter.writeBinaryFile.mock.calls[0]?.[1] as Uint8Array;
      const output = new TextDecoder().decode(bytes);

      expect(output).toContain('<svg');
      expect(output).toContain('<circle');
      expect(output).toContain('url(#local-fill)');
      expect(output).not.toContain('<script');
      expect(output).not.toContain('foreignObject');
      expect(output).not.toContain('javascript:');
      expect(output).not.toContain('example.test');
      expect(output).not.toContain('onload');
    } finally {
      dateNow.mockRestore();
    }
  });

  it('deletes global icon assets inside the icon asset directory', async () => {
    await expect(deleteGlobalIconAsset('/app/.vlaina/assets/icons/old.png')).resolves.toBe(true);

    expect(adapter.deleteFile).toHaveBeenCalledWith('/app/.vlaina/assets/icons/old.png');
  });

  it('does not delete paths outside the global icon asset directory', async () => {
    await expect(deleteGlobalIconAsset('/app/.vlaina/assets/secret.png')).resolves.toBe(false);

    expect(adapter.deleteFile).not.toHaveBeenCalled();
  });
});
