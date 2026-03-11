import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryInfo } from './githubRepoCommands';

const { isTauriMock, safeInvokeMock, webGithubCommandsMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(),
  safeInvokeMock: vi.fn(),
  webGithubCommandsMock: {
    listRepos: vi.fn(),
    getRepoTreeRecursive: vi.fn(),
    getFileContent: vi.fn(),
    commitChangeset: vi.fn(),
    createRepo: vi.fn(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  isTauri: isTauriMock,
}));

vi.mock('./invoke', () => ({
  safeInvoke: safeInvokeMock,
}));

vi.mock('./webGithubCommands', () => ({
  webGithubCommands: webGithubCommandsMock,
}));

describe('githubRepoCommands', () => {
  beforeEach(() => {
    vi.resetModules();
    isTauriMock.mockReset();
    safeInvokeMock.mockReset();
    Object.values(webGithubCommandsMock).forEach((mock) => mock.mockReset());
  });

  it('filters list results down to managed content repositories', async () => {
    isTauriMock.mockReturnValue(true);
    const repos = [
      { id: 1, name: 'nekotick-a' },
      { id: 2, name: 'other' },
      { id: 3, name: 'nekotick-config' },
    ] as RepositoryInfo[];
    safeInvokeMock.mockResolvedValue(repos);
    const { githubRepoCommands } = await import('./githubRepoCommands');

    await expect(githubRepoCommands.listRepos()).resolves.toEqual([repos[0]]);
  });

  it('rejects repository reads outside the managed prefix before invoking backend commands', async () => {
    isTauriMock.mockReturnValue(true);
    const { githubRepoCommands } = await import('./githubRepoCommands');

    await expect(
      githubRepoCommands.getRepoTreeRecursive('owner', 'other', 'main')
    ).rejects.toThrow('Only NekoTick cloud repositories can be accessed');
    expect(safeInvokeMock).not.toHaveBeenCalled();
  });

  it('normalizes repository creation into the managed prefix', async () => {
    isTauriMock.mockReturnValue(true);
    safeInvokeMock.mockResolvedValue({
      id: 1,
      name: 'nekotick-notes',
      displayName: 'notes',
      fullName: 'owner/nekotick-notes',
      owner: 'owner',
      private: true,
      htmlUrl: 'https://example.test/owner/nekotick-notes',
      defaultBranch: 'main',
      updatedAt: '2026-03-11T00:00:00Z',
      description: null,
    } satisfies RepositoryInfo);
    const { githubRepoCommands } = await import('./githubRepoCommands');

    await githubRepoCommands.createRepo('notes', true);

    expect(safeInvokeMock).toHaveBeenCalledWith(
      'create_github_repo',
      expect.objectContaining({ name: 'nekotick-notes' }),
      expect.any(Object)
    );
  });
});
