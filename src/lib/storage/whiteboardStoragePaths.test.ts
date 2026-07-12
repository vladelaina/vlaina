import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotesRootStorageKey } from './notesRootStorageKey';
import {
  getWhiteboardNotesRootPath,
  moveWhiteboardNotesRootStore,
} from './whiteboardStoragePaths';

type TestFileInfo = { isDirectory: boolean; isFile: boolean; name: string; path: string };

const mocks = vi.hoisted(() => ({
  copyFile: vi.fn(async () => undefined),
  deleteDir: vi.fn(async () => undefined),
  exists: vi.fn<(path: string) => Promise<boolean>>(async () => false),
  listDir: vi.fn<(path: string) => Promise<TestFileInfo[]>>(async () => []),
  mkdir: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
}));

vi.mock('./basePath', () => ({
  getStorageBasePath: () => Promise.resolve('/app'),
}));

vi.mock('./adapter', async () => {
  const actual = await vi.importActual<typeof import('./adapter')>('./adapter');
  return {
    ...actual,
    getStorageAdapter: () => ({
      ...mocks,
      platform: 'electron',
    }),
    joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/').replace(/\/{2,}/g, '/'),
  };
});

describe('whiteboardStoragePaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exists.mockResolvedValue(false);
    mocks.rename.mockResolvedValue(undefined);
    mocks.listDir.mockResolvedValue([]);
  });

  it('maps each notes root into the system whiteboard directory', async () => {
    await expect(getWhiteboardNotesRootPath('/notesRoot')).resolves.toBe(
      `/app/.vlaina/whiteboards/notes-roots/${getNotesRootStorageKey('/notesRoot')}`,
    );
  });

  it('copies all files before deleting the previous system store when a directory rename is unavailable', async () => {
    const source = await getWhiteboardNotesRootPath('/old');
    const destination = await getWhiteboardNotesRootPath('/new');
    mocks.exists.mockImplementation(async (path: string) => path === source);
    mocks.rename.mockRejectedValue(new Error('Cross-device rename'));
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === source) return [
        { isDirectory: false, isFile: true, name: 'index.json', path: `${path}/index.json` },
        { isDirectory: true, isFile: false, name: 'boards', path: `${path}/boards` },
      ];
      if (path.endsWith('/boards')) return [
        { isDirectory: true, isFile: false, name: 'default', path: `${path}/default` },
      ];
      return [
        { isDirectory: false, isFile: true, name: 'board.vlwb.json', path: `${path}/board.vlwb.json` },
      ];
    });

    await moveWhiteboardNotesRootStore('/old', '/new');

    expect(mocks.copyFile).toHaveBeenCalledWith(
      `${source}/index.json`,
      `${destination}/index.json`,
    );
    expect(mocks.copyFile).toHaveBeenCalledWith(
      `${source}/boards/default/board.vlwb.json`,
      `${destination}/boards/default/board.vlwb.json`,
    );
    expect(mocks.deleteDir).toHaveBeenLastCalledWith(source, true);
  });

  it('moves the system whiteboard store when a notes root path changes', async () => {
    const previous = await getWhiteboardNotesRootPath('/old');
    const next = await getWhiteboardNotesRootPath('/new');
    mocks.exists.mockImplementation(async (path: string) => path === previous);

    await moveWhiteboardNotesRootStore('/old', '/new');

    expect(mocks.rename).toHaveBeenCalledWith(previous, next);
  });
});
