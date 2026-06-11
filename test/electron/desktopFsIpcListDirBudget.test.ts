import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  assertAuthorizedFsPath: vi.fn(async (filePath: string) => filePath),
  assertAuthorizedFsRenameTarget: vi.fn(),
  assertAuthorizedFsWatchPath: vi.fn(),
  normalizeFsPathForAccess: vi.fn((filePath: string) => filePath),
  updateAuthorizedRootRename: vi.fn(),
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return '/tmp/vlaina-user-data';
        if (name === 'temp') return '/tmp';
        if (name === 'home') return '/home/test';
        return '/tmp/vlaina-user-data';
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

vi.mock('node:fs/promises', () => {
  const fsPromises = {
    copyFile: vi.fn(),
    mkdtemp: vi.fn(),
    mkdir: vi.fn(),
    open: vi.fn(),
    readdir: mocks.readdir,
    readFile: vi.fn(),
    rename: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
  };
  return {
    ...fsPromises,
    default: fsPromises,
  };
});

vi.mock('../../electron/fsAccess.mjs', () => ({
  assertAuthorizedFsPath: mocks.assertAuthorizedFsPath,
  assertAuthorizedFsRenameTarget: mocks.assertAuthorizedFsRenameTarget,
  assertAuthorizedFsWatchPath: mocks.assertAuthorizedFsWatchPath,
  authorizeFsPath: vi.fn(),
  normalizeFsPathForAccess: mocks.normalizeFsPathForAccess,
  updateAuthorizedRootRename: mocks.updateAuthorizedRootRename,
}));

import { registerDesktopIpc } from '../../electron/desktopIpc.mjs';

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

function createFileDirent(name: string) {
  return {
    name,
    isSymbolicLink: () => false,
    isDirectory: () => false,
    isFile: () => true,
  };
}

describe('desktop filesystem list directory budget', () => {
  it('caps single-directory listings before describing overflow entries', async () => {
    mocks.readdir.mockResolvedValueOnce([
      ...Array.from({ length: 20_000 }, (_value, index) =>
        createFileDirent(`note-${String(index).padStart(5, '0')}.md`)
      ),
      {
        name: 'overflow.md',
        isSymbolicLink: () => {
          throw new Error('overflow entry should not be described');
        },
      },
    ]);
    const { handlers } = registerHarness();

    const entries = await handlers.get('desktop:fs:list-dir')?.({}, '/vault');

    expect(entries).toHaveLength(20_000);
    expect(entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'overflow.md' }),
      ]),
    );
  });

  it('prioritizes markdown entries before applying the single-directory cap', async () => {
    mocks.readdir.mockResolvedValueOnce([
      ...Array.from({ length: 20_000 }, (_value, index) =>
        createFileDirent(`asset-${String(index).padStart(5, '0')}.png`)
      ),
      createFileDirent('late.md'),
    ]);
    const { handlers } = registerHarness();

    const entries = await handlers.get('desktop:fs:list-dir')?.({}, '/vault');

    expect(entries).toHaveLength(20_000);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'late.md' }),
      ]),
    );
    expect(entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'asset-19999.png' }),
      ]),
    );
  });
});
