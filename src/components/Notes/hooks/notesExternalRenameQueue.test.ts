import { describe, expect, it } from 'vitest';
import {
  flushExpiredPendingRenames,
  getNextPendingRenameDelay,
  matchPendingRename,
  queuePendingRename,
} from './notesExternalRenameQueue';

describe('notesExternalRenameQueue', () => {
  it('queues pending rename-from entries with an expiration', () => {
    expect(queuePendingRename([], 'docs/alpha.md', 100, 200)).toEqual([
      { oldPath: 'docs/alpha.md', expiresAt: 300 },
    ]);
  });

  it('matches the oldest pending rename when a rename-to event arrives', () => {
    const queue = [
      { oldPath: 'docs/alpha.md', expiresAt: 300 },
      { oldPath: 'docs/beta.md', expiresAt: 400 },
    ];

    expect(matchPendingRename(queue, 150)).toEqual({
      queue: [{ oldPath: 'docs/beta.md', expiresAt: 400 }],
      oldPath: 'docs/alpha.md',
    });
  });

  it('flushes expired rename-from entries into deletions', () => {
    expect(
      flushExpiredPendingRenames(
        [
          { oldPath: 'docs/alpha.md', expiresAt: 100 },
          { oldPath: 'docs/beta.md', expiresAt: 220 },
        ],
        180
      )
    ).toEqual({
      queue: [{ oldPath: 'docs/beta.md', expiresAt: 220 }],
      expiredPaths: ['docs/alpha.md'],
    });
  });

  it('computes the next flush delay from the earliest pending rename', () => {
    expect(
      getNextPendingRenameDelay(
        [
          { oldPath: 'docs/alpha.md', expiresAt: 160 },
          { oldPath: 'docs/beta.md', expiresAt: 240 },
        ],
        120
      )
    ).toBe(40);
    expect(getNextPendingRenameDelay([], 120)).toBeNull();
  });
});
