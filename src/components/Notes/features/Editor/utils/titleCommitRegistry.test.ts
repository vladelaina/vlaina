import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushCurrentTitleCommit, registerCurrentTitleCommitter } from './titleCommitRegistry';

describe('titleCommitRegistry', () => {
  afterEach(async () => {
    registerCurrentTitleCommitter(() => undefined)();
    await flushCurrentTitleCommit();
  });

  it('flushes the current title committer', async () => {
    const commit = vi.fn(async () => undefined);

    registerCurrentTitleCommitter(commit);
    await flushCurrentTitleCommit();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest registered committer active', async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const unregisterFirst = registerCurrentTitleCommitter(first);

    registerCurrentTitleCommitter(second);
    unregisterFirst();
    await flushCurrentTitleCommit();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
