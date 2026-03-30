import { describe, expect, it } from 'vitest';
import { setNoteTabDirtyState } from './noteTabState';

describe('noteTabState', () => {
  it('updates only the matching tab dirty state', () => {
    expect(
      setNoteTabDirtyState(
        [
          { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
          { path: 'docs/beta.md', name: 'beta', isDirty: false },
        ],
        'docs/alpha.md',
        true
      )
    ).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
    ]);
  });

  it('returns the same array when no dirty-state change is needed', () => {
    const openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }];
    expect(setNoteTabDirtyState(openTabs, 'docs/alpha.md', true)).toBe(openTabs);
  });
});
