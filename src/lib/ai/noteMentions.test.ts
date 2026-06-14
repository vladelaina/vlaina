import { describe, expect, it } from 'vitest';
import {
  dedupeNoteMentions,
  isPotentiallyLoadableNoteMentionReference,
  MAX_NOTE_MENTION_PATH_CHARS,
  MAX_NOTE_MENTION_TITLE_CHARS,
} from './noteMentions';

describe('note mention normalization', () => {
  it('rejects overlong raw paths before trimming', () => {
    const paddedPath = `${' '.repeat(MAX_NOTE_MENTION_PATH_CHARS)}docs/alpha.md`;

    expect(dedupeNoteMentions([
      { path: paddedPath, title: 'Alpha' },
      { path: 'docs/beta.md', title: 'Beta' },
    ])).toEqual([
      { path: 'docs/beta.md', title: 'Beta', kind: 'note' },
    ]);
    expect(isPotentiallyLoadableNoteMentionReference({ path: paddedPath }, 'note')).toBe(false);
  });

  it('trims and bounds normal title text', () => {
    expect(dedupeNoteMentions([
      {
        path: 'docs/alpha.md',
        title: ` ${'A'.repeat(MAX_NOTE_MENTION_TITLE_CHARS + 1)} `,
      },
    ])).toEqual([
      {
        path: 'docs/alpha.md',
        title: 'A'.repeat(MAX_NOTE_MENTION_TITLE_CHARS),
        kind: 'note',
      },
    ]);
  });

  it('falls back to the path for overlong raw titles', () => {
    expect(dedupeNoteMentions([
      {
        path: 'docs/alpha.md',
        title: 'A'.repeat(5000),
      },
    ])).toEqual([
      {
        path: 'docs/alpha.md',
        title: 'docs/alpha.md',
        kind: 'note',
      },
    ]);
  });
});
