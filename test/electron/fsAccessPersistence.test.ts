import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(async (filePath: string) => filePath),
  stat: vi.fn(),
  writeFile: vi.fn(),
  app: {
    getPath: vi.fn(() => '/tmp/vlaina-user-data'),
  },
}));

vi.mock('electron', () => ({
  default: {
    app: mocks.app,
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    realpath: mocks.realpath,
    stat: mocks.stat,
    writeFile: mocks.writeFile,
  },
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  realpath: mocks.realpath,
  stat: mocks.stat,
  writeFile: mocks.writeFile,
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    realpath: mocks.realpath,
    stat: mocks.stat,
    writeFile: mocks.writeFile,
  },
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  realpath: mocks.realpath,
  stat: mocks.stat,
  writeFile: mocks.writeFile,
}));

describe('desktop filesystem authorization persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.app.getPath.mockReturnValue('/tmp/vlaina-user-data');
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    mocks.realpath.mockImplementation(async (filePath: string) => filePath);
    mocks.stat.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    mocks.writeFile.mockResolvedValue(undefined);
  });

  it('recovers future authorization saves after one persistence write fails', async () => {
    const {
      authorizeFsPath,
      normalizeFsPathForAccess,
      normalizeFsPathKey,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();
    const expectedProjectTwoPath = normalizeFsPathForAccess('/tmp/project-two');
    const expectedProjectTwoKey = normalizeFsPathKey(expectedProjectTwoPath);
    mocks.writeFile
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);

    await expect(authorizeFsPath('/tmp/project-one', 'root')).rejects.toThrow('disk full');
    await expect(authorizeFsPath('/tmp/project-two', 'root')).resolves.toBe(expectedProjectTwoPath);

    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
    const persistedPayload = JSON.parse(String(mocks.writeFile.mock.calls[1]?.[1]));
    expect(persistedPayload.roots).toContain(expectedProjectTwoKey);
  });

  it('ignores oversized persisted authorization files before reading them', async () => {
    const {
      assertAuthorizedFsPath,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();
    mocks.stat.mockResolvedValue({
      isFile: () => true,
      size: 600 * 1024,
    });
    mocks.readFile.mockRejectedValue(new Error('oversized file must not be read'));

    await expect(assertAuthorizedFsPath('/tmp/saved-notesRoot/note.md')).rejects.toThrow(
      'File path is not authorized for desktop access',
    );
  });

  it('ignores persisted authorization content that exceeds the limit after read', async () => {
    const {
      assertAuthorizedFsPath,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();
    mocks.stat.mockResolvedValue({
      isFile: () => true,
      size: 128,
    });
    mocks.readFile.mockResolvedValue('x'.repeat(512 * 1024 + 1));

    await expect(assertAuthorizedFsPath('/tmp/saved-notesRoot/note.md')).rejects.toThrow(
      'File path is not authorized for desktop access',
    );

    expect(mocks.readFile).toHaveBeenCalled();
  });

  it('bounds persisted authorization entries before resolving them', async () => {
    const {
      MAX_AUTHORIZED_FS_PATH_CHARS,
      MAX_AUTHORIZED_FS_PATH_ENTRIES,
      assertAuthorizedFsPath,
      isAuthorizedFsPathKey,
      normalizeFsPathForAccess,
      normalizeFsPathKey,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();
    const savedRoots = [
      ...Array.from({ length: MAX_AUTHORIZED_FS_PATH_ENTRIES + 10 }, (_, index) => `/tmp/saved-${index}`),
      `/tmp/${'x'.repeat(MAX_AUTHORIZED_FS_PATH_CHARS + 1)}`,
    ];
    mocks.stat.mockResolvedValue({
      isFile: () => true,
      size: 128,
    });
    mocks.readFile.mockResolvedValue(JSON.stringify({
      roots: savedRoots,
      files: savedRoots,
      watchRoots: savedRoots,
    }));

    await expect(assertAuthorizedFsPath('/tmp/saved-0')).resolves.toBe(normalizeFsPathForAccess('/tmp/saved-0'));
    expect(isAuthorizedFsPathKey(normalizeFsPathKey('/tmp/saved-0/note.md'))).toBe(true);
    await expect(assertAuthorizedFsPath('/tmp/saved-0/note.md')).resolves.toBe(normalizeFsPathForAccess('/tmp/saved-0/note.md'));
    await expect(assertAuthorizedFsPath(`/tmp/saved-${MAX_AUTHORIZED_FS_PATH_ENTRIES + 1}/note.md`)).rejects.toThrow(
      'File path is not authorized for desktop access',
    );

    expect(mocks.realpath.mock.calls.length).toBeLessThanOrEqual((MAX_AUTHORIZED_FS_PATH_ENTRIES * 6) + 8);
    expect(mocks.realpath.mock.calls.some(([filePath]) => String(filePath).length > MAX_AUTHORIZED_FS_PATH_CHARS))
      .toBe(false);
  });

  it('rejects excessively long filesystem paths before resolving them', async () => {
    const {
      MAX_AUTHORIZED_FS_PATH_CHARS,
      assertAuthorizedFsPath,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();

    await expect(assertAuthorizedFsPath(`/tmp/${'x'.repeat(MAX_AUTHORIZED_FS_PATH_CHARS + 1)}`)).rejects.toThrow(
      'file path is too long',
    );

    expect(mocks.realpath).not.toHaveBeenCalled();
  });
});
