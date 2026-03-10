import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSyncCommitMessage,
  clearSyncTimer,
  collectTreePaths,
  createCommitMessage,
  getDraftCountsForRepository,
  getSyncStatusForRepository,
  isPathWithinFolder,
  registerSyncTimer,
  resolveSyncStatusFromDrafts,
} from './storeSupport';
import { createDraftRecord, createFileNode, createFolderNode } from './testUtils';

describe('cloud repo store support helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 8, 9, 10));
  });

  afterEach(() => {
    clearSyncTimer(99);
    vi.useRealTimers();
  });

  it('builds a timestamped sync commit message', () => {
    expect(buildSyncCommitMessage()).toBe('sync: 2026-03-10 08:09:10');
  });

  it('creates descriptive commit messages for remote actions', () => {
    expect(createCommitMessage('rename', 'docs/a.md -> docs/b.md')).toBe(
      'rename: docs/a.md -> docs/b.md'
    );
  });

  it('collects every visible path from the tree recursively', () => {
    const paths = collectTreePaths([
      createFolderNode('docs', [createFileNode('docs/a.md')]),
      createFileNode('b.md'),
    ]);

    expect(Array.from(paths)).toEqual(['docs', 'docs/a.md', 'b.md']);
  });

  it('matches both folder roots and nested paths', () => {
    expect(isPathWithinFolder('docs', 'docs')).toBe(true);
    expect(isPathWithinFolder('docs/a.md', 'docs')).toBe(true);
    expect(isPathWithinFolder('other/a.md', 'docs')).toBe(false);
  });

  it('derives sync status and draft counts from repository drafts', () => {
    const drafts = [
      createDraftRecord(1, 'docs/a.md', 'dirty'),
      createDraftRecord(1, 'docs/b.md', 'conflict'),
      createDraftRecord(2, 'docs/c.md', 'dirty'),
    ];

    expect(resolveSyncStatusFromDrafts([createDraftRecord(1, 'docs/a.md', 'conflict')])).toBe(
      'error'
    );
    expect(getDraftCountsForRepository(drafts, 1)).toEqual({ dirty: 1, conflict: 1 });
    expect(getSyncStatusForRepository(drafts, 1)).toBe('error');
    expect(getSyncStatusForRepository(drafts, 2)).toBe('has_changes');
    expect(getSyncStatusForRepository(drafts, 3)).toBe('synced');
  });

  it('clears registered sync timers before they can fire', async () => {
    const callback = vi.fn();
    registerSyncTimer(
      99,
      setTimeout(callback, 1000) as unknown as ReturnType<typeof setTimeout>
    );

    clearSyncTimer(99);
    await vi.advanceTimersByTimeAsync(1000);

    expect(callback).not.toHaveBeenCalled();
  });
});
