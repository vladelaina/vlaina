import { describe, expect, it } from 'vitest';
import {
  assertManagedContentRepoAccess,
  assertManagedContentRepoName,
  filterManagedContentRepositories,
  hasManagedContentRepoAccess,
  isManagedConfigRepoName,
  isManagedContentRepoName,
  normalizeManagedContentRepoName,
} from './githubManagedRepoPolicy';

describe('githubManagedRepoPolicy', () => {
  it('recognizes content repositories and excludes config repository', () => {
    expect(isManagedContentRepoName('nekotick-notes')).toBe(true);
    expect(isManagedContentRepoName('NekoTick-Notes')).toBe(true);
    expect(isManagedContentRepoName('nekotick-config')).toBe(false);
    expect(isManagedContentRepoName('notes')).toBe(false);
    expect(isManagedConfigRepoName('NekoTick-Config')).toBe(true);
  });

  it('normalizes creation inputs into managed content repository names', () => {
    expect(normalizeManagedContentRepoName('notes')).toBe('nekotick-notes');
    expect(normalizeManagedContentRepoName('nekotick-notes')).toBe('nekotick-notes');
  });

  it('rejects non managed content repository names', () => {
    expect(() => assertManagedContentRepoName('notes')).toThrow(
      'Only NekoTick cloud repositories can be accessed'
    );
    expect(() => assertManagedContentRepoName('nekotick-config')).toThrow(
      'Only NekoTick cloud repositories can be accessed'
    );
  });

  it('filters mixed repository lists down to managed content repositories', () => {
    const repos = [
      { id: 1, name: 'nekotick-a' },
      { id: 2, name: 'other' },
      { id: 3, name: 'nekotick-config' },
      { id: 4, name: 'NekoTick-B' },
    ];

    expect(filterManagedContentRepositories(repos)).toEqual([
      { id: 1, name: 'nekotick-a' },
      { id: 4, name: 'NekoTick-B' },
    ]);
  });

  it('enforces exact access against discovered repositories', () => {
    const repos = [
      { owner: 'alice', name: 'nekotick-a' },
      { owner: 'team', name: 'nekotick-shared' },
      { owner: 'alice', name: 'nekotick-config' },
    ];

    expect(hasManagedContentRepoAccess(repos, 'alice', 'nekotick-a')).toBe(true);
    expect(hasManagedContentRepoAccess(repos, 'TEAM', 'NekoTick-Shared')).toBe(true);
    expect(hasManagedContentRepoAccess(repos, 'alice', 'nekotick-config')).toBe(false);
    expect(hasManagedContentRepoAccess(repos, 'bob', 'nekotick-a')).toBe(false);
    expect(() =>
      assertManagedContentRepoAccess(repos, 'bob', 'nekotick-a')
    ).toThrow('Only discovered NekoTick cloud repositories can be accessed');
  });
});
