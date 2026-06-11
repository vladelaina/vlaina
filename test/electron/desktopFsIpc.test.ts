import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const hoisted = vi.hoisted(() => ({
  userDataPath: '',
  tempPath: '',
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return hoisted.userDataPath;
        if (name === 'temp') return hoisted.tempPath || os.tmpdir();
        if (name === 'home') return os.homedir();
        return hoisted.userDataPath;
      }),
    },
    BrowserWindow: vi.fn(),
    clipboard: {
      writeText: vi.fn(),
      writeImage: vi.fn(),
    },
    dialog: {},
    nativeImage: {
      createFromDataURL: vi.fn(() => ({ isEmpty: () => false })),
    },
    shell: {
      openExternal: vi.fn(),
      openPath: vi.fn(),
      trashItem: vi.fn(),
      showItemInFolder: vi.fn(),
    },
  },
}));

import { registerDesktopIpc } from '../../electron/desktopIpc.mjs';
import { authorizeFsPath, resetAuthorizedFsPathsForTests } from '../../electron/fsAccess.mjs';

function registerHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  registerDesktopIpc({
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    normalizeExternalUrl: (url: string) => url,
    resolveTargetWindow: vi.fn(() => null),
    requireNonEmptyString: (value: string) => value,
    requireStringArray: (value: string[]) => value,
  });

  return { handlers };
}

describe('desktop filesystem ipc', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vlaina-desktop-fs-ipc-'));
    hoisted.userDataPath = path.join(tempDir, 'user-data');
    hoisted.tempPath = path.join(tempDir, 'tmp');
    await mkdir(hoisted.userDataPath, { recursive: true });
    await mkdir(hoisted.tempPath, { recursive: true });
    resetAuthorizedFsPathsForTests();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads small authorized files through the filesystem bridge', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const filePath = path.join(rootPath, 'note.md');
    await mkdir(rootPath, { recursive: true });
    await writeFile(filePath, 'hello', 'utf8');
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:read-text')?.({}, filePath)).resolves.toBe('hello');
    await expect(handlers.get('desktop:fs:read-binary')?.({}, filePath)).resolves.toEqual(
      new Uint8Array([104, 101, 108, 108, 111]),
    );
  });

  it('rejects oversized authorized files before reading them through the filesystem bridge', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const filePath = path.join(rootPath, 'huge.bin');
    await mkdir(rootPath, { recursive: true });
    await writeFile(filePath, '', 'utf8');
    await truncate(filePath, 64 * 1024 * 1024 + 1);
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:read-binary')?.({}, filePath)).rejects.toThrow(
      'Desktop file is too large to read',
    );
    await expect(handlers.get('desktop:fs:read-text')?.({}, filePath)).rejects.toThrow(
      'Desktop file is too large to read',
    );
  });

  it('rejects invalid binary write payloads through the filesystem bridge', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const filePath = path.join(rootPath, 'note.bin');
    await mkdir(rootPath, { recursive: true });
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:write-binary')?.({}, filePath, 'not bytes')).rejects.toThrow(
      'Desktop binary content must be a byte array',
    );
    await expect(handlers.get('desktop:fs:write-binary')?.({}, filePath, [0, 256])).rejects.toThrow(
      'Desktop binary content must contain only byte values',
    );
  });

  it('rejects oversized binary write payloads before materializing buffers', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const filePath = path.join(rootPath, 'huge.bin');
    await mkdir(rootPath, { recursive: true });
    await authorizeFsPath(rootPath, 'root');
    const oversizedBytes: number[] = [];
    oversizedBytes.length = 64 * 1024 * 1024 + 1;
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:write-binary')?.({}, filePath, oversizedBytes)).rejects.toThrow(
      'Desktop content is too large to write',
    );
  });

  it('rejects appending text past the desktop write size limit', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const filePath = path.join(rootPath, 'huge.md');
    await mkdir(rootPath, { recursive: true });
    await writeFile(filePath, '', 'utf8');
    await truncate(filePath, 64 * 1024 * 1024);
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:write-text')?.({}, filePath, 'x', { append: true })).rejects.toThrow(
      'Desktop content is too large to write',
    );
    await expect(readFile(filePath)).resolves.toHaveLength(64 * 1024 * 1024);
  });

  it('rejects protected app data files during drag-drop authorization', async () => {
    const protectedPath = path.join(hoisted.userDataPath, '.vlaina', 'store', 'account-secrets.json');
    await mkdir(path.dirname(protectedPath), { recursive: true });
    await writeFile(protectedPath, '{}', 'utf8');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:drag-drop:authorize-path')?.({}, protectedPath)).rejects.toThrow(
      'File path is reserved for internal desktop storage',
    );
  });

  it('lists authorized symlinked markdown files as readable files', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const targetPath = path.join(rootPath, 'target.md');
    const linkPath = path.join(rootPath, 'linked.md');
    await mkdir(rootPath, { recursive: true });
    await writeFile(targetPath, '# target', 'utf8');
    await symlink(targetPath, linkPath, 'file');
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:list-dir')?.({}, rootPath)).resolves.toEqual(
      expect.arrayContaining([
        {
          name: 'linked.md',
          path: linkPath,
          isDirectory: false,
          isFile: true,
        },
      ]),
    );
    await expect(handlers.get('desktop:fs:read-text')?.({}, linkPath)).resolves.toBe('# target');
  });

  it('lists authorized symlinked directories as readable directories', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const targetDirPath = path.join(rootPath, 'target-docs');
    const targetPath = path.join(targetDirPath, 'inside.md');
    const linkPath = path.join(rootPath, 'linked-docs');
    await mkdir(targetDirPath, { recursive: true });
    await writeFile(targetPath, '# inside', 'utf8');
    await symlink(targetDirPath, linkPath, 'dir');
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:list-dir')?.({}, rootPath)).resolves.toEqual(
      expect.arrayContaining([
        {
          name: 'linked-docs',
          path: linkPath,
          isDirectory: true,
          isFile: false,
        },
      ]),
    );
    await expect(handlers.get('desktop:fs:list-dir')?.({}, linkPath)).resolves.toEqual(
      expect.arrayContaining([
        {
          name: 'inside.md',
          path: path.join(linkPath, 'inside.md'),
          isDirectory: false,
          isFile: true,
        },
      ]),
    );
  });

  it('does not list symlinked files that resolve outside authorized roots as readable files', async () => {
    const rootPath = path.join(tempDir, 'vault');
    const outsidePath = path.join(tempDir, 'outside.md');
    const linkPath = path.join(rootPath, 'outside.md');
    await mkdir(rootPath, { recursive: true });
    await writeFile(outsidePath, '# outside', 'utf8');
    await symlink(outsidePath, linkPath, 'file');
    await authorizeFsPath(rootPath, 'root');
    const { handlers } = registerHarness();

    await expect(handlers.get('desktop:fs:list-dir')?.({}, rootPath)).resolves.toEqual(
      expect.arrayContaining([
        {
          name: 'outside.md',
          path: linkPath,
          isDirectory: false,
          isFile: false,
        },
      ]),
    );
    await expect(handlers.get('desktop:fs:read-text')?.({}, linkPath)).rejects.toThrow(
      'File path is not authorized for desktop access',
    );
  });

});
