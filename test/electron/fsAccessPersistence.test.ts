import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(async (filePath: string) => filePath),
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
    writeFile: mocks.writeFile,
  },
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  realpath: mocks.realpath,
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
});
