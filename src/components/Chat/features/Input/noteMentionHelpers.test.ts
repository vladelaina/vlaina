import { describe, expect, it } from 'vitest';
import {
  buildMentionPreviewParts,
  collectMentionCandidates,
  valueContainsMentionLabel,
} from './noteMentionHelpers';
import type { FileTreeNode } from '@/stores/notes/types';

function createTree(): FileTreeNode[] {
  return [
    {
      id: 'docs',
      name: 'docs',
      path: 'docs',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs/alpha.md',
          name: 'alpha',
          path: 'docs/alpha.md',
          isFolder: false,
        },
        {
          id: 'docs/beta.markdown',
          name: 'beta',
          path: 'docs/beta.markdown',
          isFolder: false,
        },
        {
          id: 'docs/gamma.mdown',
          name: 'gamma',
          path: 'docs/gamma.mdown',
          isFolder: false,
        },
        {
          id: 'docs/skip.txt',
          name: 'skip',
          path: 'docs/skip.txt',
          isFolder: false,
        },
      ],
    },
  ];
}

describe('collectMentionCandidates', () => {
  it('includes every supported markdown note in the mention list', () => {
    const candidates = [];

    collectMentionCandidates(createTree(), candidates);

    expect(candidates).toEqual([
      {
        path: 'docs',
        title: 'docs/',
        kind: 'folder',
        isCurrent: false,
      },
      {
        path: 'docs/alpha.md',
        title: '',
        kind: 'note',
        isCurrent: false,
        notePath: 'docs/alpha.md',
      },
      {
        path: 'docs/beta.markdown',
        title: '',
        kind: 'note',
        isCurrent: false,
        notePath: 'docs/beta.markdown',
      },
      {
        path: 'docs/gamma.mdown',
        title: '',
        kind: 'note',
        isCurrent: false,
        notePath: 'docs/gamma.mdown',
      },
    ]);
  });
});

describe('mention label matching', () => {
  it('matches inserted mention labels only on mention boundaries', () => {
    expect(valueContainsMentionLabel('@Today please', 'Today')).toBe(true);
    expect(valueContainsMentionLabel('see (@Today) please', 'Today')).toBe(true);
    expect(valueContainsMentionLabel('email me@Today please', 'Today')).toBe(false);
    expect(valueContainsMentionLabel('prefix@Today please', 'Today')).toBe(false);
    expect(valueContainsMentionLabel('@TodayLater please', 'Today')).toBe(false);
  });

  it('does not render mention previews for labels embedded in ordinary text', () => {
    const parts = buildMentionPreviewParts('email me@Today please, then @Today ', [
      { path: 'Today.md', title: 'Today', kind: 'note' },
    ]);

    expect(parts.filter((part) => part.type === 'mention')).toEqual([
      expect.objectContaining({
        text: '@Today',
        start: 28,
        end: 34,
      }),
    ]);
  });
});
