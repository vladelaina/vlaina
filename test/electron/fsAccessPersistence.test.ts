import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
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
    writeFile: mocks.writeFile,
  },
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}));

describe('desktop filesystem authorization persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.app.getPath.mockReturnValue('/tmp/vlaina-user-data');
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    mocks.writeFile.mockResolvedValue(undefined);
  });

  it('recovers future authorization saves after one persistence write fails', async () => {
    const {
      authorizeFsPath,
      resetAuthorizedFsPathsForTests,
    } = await import('../../electron/fsAccess.mjs');
    resetAuthorizedFsPathsForTests();
    mocks.writeFile
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);

    await expect(authorizeFsPath('/tmp/project-one', 'root')).rejects.toThrow('disk full');
    await expect(authorizeFsPath('/tmp/project-two', 'root')).resolves.toBe('/tmp/project-two');

    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
    expect(String(mocks.writeFile.mock.calls[1]?.[1])).toContain('/tmp/project-two');
  });
});
