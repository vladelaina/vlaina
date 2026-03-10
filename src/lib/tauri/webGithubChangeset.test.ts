import { describe, expect, it, vi } from 'vitest';
import type { RepoChangeOperation } from './githubRepoCommands';
import type { WebGithubChangesetFetch } from './webGithubChangeset';
import { commitWebGithubChangeset, detectChangesetConflicts } from './webGithubChangeset';

function createGithubFetch(
  handler: (path: string, init?: RequestInit) => Promise<unknown>
) {
  const githubFetchMock = vi.fn(handler);
  const githubFetch: WebGithubChangesetFetch = <T>(path: string, init?: RequestInit) =>
    githubFetchMock(path, init) as Promise<T>;
  return { githubFetch, githubFetchMock };
}

describe('detectChangesetConflicts', () => {
  it('classifies all conflict reasons consistently', () => {
    const operations: RepoChangeOperation[] = [
      { operationType: 'upsert', path: 'modified.md', previousSha: 'old' },
      { operationType: 'delete', path: 'deleted.md', previousSha: 'gone' },
      { operationType: 'upsert', path: 'created.md', previousSha: null },
      { operationType: 'upsert', path: 'missing.md', previousSha: null },
    ];

    const currentShas = new Map<string, string>([
      ['modified.md', 'new'],
      ['created.md', 'exists'],
    ]);

    expect(detectChangesetConflicts(operations, currentShas)).toEqual([
      { path: 'modified.md', reason: 'modified' },
      { path: 'deleted.md', reason: 'deleted' },
      { path: 'created.md', reason: 'created' },
    ]);
  });

  it('returns no conflicts when shas match expected base', () => {
    const operations: RepoChangeOperation[] = [
      { operationType: 'upsert', path: 'same.md', previousSha: 'sha-a' },
      { operationType: 'upsert', path: 'new.md', previousSha: null },
    ];

    const currentShas = new Map<string, string>([['same.md', 'sha-a']]);
    expect(detectChangesetConflicts(operations, currentShas)).toEqual([]);
  });
});

describe('commitWebGithubChangeset', () => {
  it('stops before blob/tree/commit writes when conflicts exist', async () => {
    const { githubFetch, githubFetchMock } = createGithubFetch(async (path) => {
      if (path.includes('/git/ref/heads/')) {
        return { object: { sha: 'head-1' } };
      }
      if (path.includes('/git/commits/')) {
        return { tree: { sha: 'tree-1' } };
      }
      if (path.includes('/git/trees/')) {
        return {
          sha: 'tree-1',
          tree: [{ path: 'note.md', sha: 'remote-sha', type: 'blob' }],
        };
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const result = await commitWebGithubChangeset({
      githubFetch,
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      message: 'sync',
      operations: [{ operationType: 'upsert', path: 'note.md', content: 'x', previousSha: 'base' }],
    });

    expect(result).toEqual({
      status: 'conflict',
      commit: null,
      conflicts: [{ path: 'note.md', reason: 'modified' }],
      updatedFiles: [],
    });
    expect(githubFetchMock.mock.calls.some(([path]) => String(path).includes('/git/blobs'))).toBe(false);
  });

  it('creates blobs, tree, commit, and ref update for clean changesets', async () => {
    const { githubFetch, githubFetchMock } = createGithubFetch(async (path) => {
      if (path.includes('/git/ref/heads/')) {
        return { object: { sha: 'head-1' } };
      }
      if (path.includes('/git/commits/')) {
        return { tree: { sha: 'tree-1' } };
      }
      if (path.endsWith('/git/trees/tree-1?recursive=1')) {
        return { sha: 'tree-1', tree: [] };
      }
      if (path.endsWith('/git/blobs')) {
        return { sha: 'blob-1' };
      }
      if (path.endsWith('/git/trees')) {
        return { sha: 'tree-2' };
      }
      if (path.endsWith('/git/commits')) {
        return { sha: 'commit-1', html_url: 'https://example.test/commit/1' };
      }
      if (path.includes('/git/refs/heads/')) {
        return {};
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const result = await commitWebGithubChangeset({
      githubFetch,
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      message: 'sync',
      operations: [{ operationType: 'upsert', path: 'note.md', content: 'hello', previousSha: null }],
    });

    expect(result).toEqual({
      status: 'committed',
      commit: {
        sha: 'commit-1',
        message: 'sync',
        htmlUrl: 'https://example.test/commit/1',
      },
      conflicts: [],
      updatedFiles: [{ path: 'note.md', sha: 'blob-1' }],
    });
    expect(githubFetchMock.mock.calls.some(([path]) => String(path).includes('/git/blobs'))).toBe(true);
  });
});
