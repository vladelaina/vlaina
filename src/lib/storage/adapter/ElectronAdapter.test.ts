import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bridge: {
    fs: {
      readTextFile: vi.fn().mockResolvedValue('hello'),
      readBinaryFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
      writeTextFile: vi.fn().mockResolvedValue(undefined),
      writeBinaryFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      deleteDir: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
      listDir: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ path: '/tmp/a.md', name: 'a.md', isFile: true, isDirectory: false }),
    },
    path: {
      appDataDir: vi.fn().mockResolvedValue('/appdata'),
    },
  },
  getElectronBridge: vi.fn(),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

import { ElectronAdapter } from './ElectronAdapter';

describe('ElectronAdapter', () => {
  beforeEach(() => {
    mocks.getElectronBridge.mockReturnValue(mocks.bridge);
    for (const group of [mocks.bridge.fs, mocks.bridge.path]) {
      for (const value of Object.values(group)) {
        if (typeof value === 'function' && 'mockClear' in value) {
          value.mockClear();
        }
      }
    }
  });

  it('delegates basic fs operations through the electron bridge', async () => {
    const adapter = new ElectronAdapter();

    await expect(adapter.readFile('/tmp/a.md')).resolves.toBe('hello');
    await expect(adapter.readBinaryFile('/tmp/a.bin')).resolves.toEqual(new Uint8Array([1, 2]));
    await adapter.writeFile('/tmp/a.md', '# note', { recursive: true });
    await adapter.deleteFile('/tmp/a.md');
    await adapter.deleteDir('/tmp/dir', true);
    await expect(adapter.exists('/tmp/a.md')).resolves.toBe(true);
    await adapter.mkdir('/tmp/dir', true);
    await adapter.rename('/tmp/a.md', '/tmp/b.md');
    await adapter.copyFile('/tmp/b.md', '/tmp/c.md');
    await expect(adapter.stat('/tmp/c.md')).resolves.toMatchObject({ name: 'a.md' });

    expect(mocks.bridge.fs.writeTextFile).toHaveBeenCalledWith('/tmp/a.md', '# note', { recursive: true });
    expect(mocks.bridge.fs.deleteFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(mocks.bridge.fs.deleteDir).toHaveBeenCalledWith('/tmp/dir', true);
    expect(mocks.bridge.fs.mkdir).toHaveBeenCalledWith('/tmp/dir', true);
    expect(mocks.bridge.fs.rename).toHaveBeenCalledWith('/tmp/a.md', '/tmp/b.md');
    expect(mocks.bridge.fs.copyFile).toHaveBeenCalledWith('/tmp/b.md', '/tmp/c.md');
  });

  it('creates parent directories before recursive binary writes', async () => {
    const adapter = new ElectronAdapter();

    await adapter.writeBinaryFile('/tmp/assets/image.png', new Uint8Array([7, 8]), { recursive: true });

    expect(mocks.bridge.fs.mkdir).toHaveBeenCalledWith('/tmp/assets', true);
    expect(mocks.bridge.fs.writeBinaryFile).toHaveBeenCalledWith('/tmp/assets/image.png', new Uint8Array([7, 8]));
  });

  it('filters hidden entries by default and walks directories recursively when requested', async () => {
    mocks.bridge.fs.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault') {
        return [
          { name: '.hidden', path: '/vault/.hidden', isDirectory: false, isFile: true },
          { name: 'docs', path: '/vault/docs', isDirectory: true, isFile: false },
          { name: 'a.md', path: '/vault/a.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/vault/docs') {
        return [
          { name: 'b.md', path: '/vault/docs/b.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const adapter = new ElectronAdapter();

    await expect(adapter.listDir('/vault')).resolves.toEqual([
      { name: 'docs', path: '/vault/docs', isDirectory: true, isFile: false },
      { name: 'a.md', path: '/vault/a.md', isDirectory: false, isFile: true },
    ]);

    await expect(adapter.listDir('/vault', { recursive: true })).resolves.toEqual([
      { name: 'docs', path: '/vault/docs', isDirectory: true, isFile: false },
      { name: 'b.md', path: '/vault/docs/b.md', isDirectory: false, isFile: true },
      { name: 'a.md', path: '/vault/a.md', isDirectory: false, isFile: true },
    ]);
  });

  it('caches the electron app data base path', async () => {
    const adapter = new ElectronAdapter();

    await expect(adapter.getBasePath()).resolves.toBe('/appdata');
    await expect(adapter.getBasePath()).resolves.toBe('/appdata');

    expect(mocks.bridge.path.appDataDir).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when the electron bridge is unavailable', async () => {
    mocks.getElectronBridge.mockReturnValue(null as never);
    const adapter = new ElectronAdapter();

    await expect(adapter.readFile('/tmp/a.md')).rejects.toThrow('Electron fs bridge is not available.');
    await expect(adapter.getBasePath()).rejects.toThrow('Electron path bridge is not available.');
  });
});
