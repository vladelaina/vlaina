import { describe, expect, it } from 'vitest';
import { shouldShowDirtyTabIndicator } from './dirtyTabIndicator';

describe('shouldShowDirtyTabIndicator', () => {
  it('hides active regular dirty notes because autosave can clear them', () => {
    expect(shouldShowDirtyTabIndicator({
      path: 'docs/alpha.md',
      isDirty: true,
      isActive: true,
      notesPath: '/vault',
      hasSaveError: false,
    })).toBe(false);
  });

  it('shows active dirty notes when saving failed', () => {
    expect(shouldShowDirtyTabIndicator({
      path: 'docs/alpha.md',
      isDirty: true,
      isActive: true,
      notesPath: '/vault',
      hasSaveError: true,
    })).toBe(true);
  });

  it('shows active drafts that cannot autosave into a vault', () => {
    expect(shouldShowDirtyTabIndicator({
      path: 'draft:blank',
      isDirty: true,
      isActive: true,
      notesPath: '',
      draftNote: { parentPath: null, name: '' },
      hasSaveError: false,
    })).toBe(true);
  });

  it('hides active drafts that can autosave into the current vault', () => {
    expect(shouldShowDirtyTabIndicator({
      path: 'draft:blank',
      isDirty: true,
      isActive: true,
      notesPath: '/vault',
      draftNote: { parentPath: null, name: '' },
      hasSaveError: false,
    })).toBe(false);
  });

  it('shows dirty background tabs because they are not the live autosave target', () => {
    expect(shouldShowDirtyTabIndicator({
      path: 'docs/background.md',
      isDirty: true,
      isActive: false,
      notesPath: '/vault',
      hasSaveError: false,
    })).toBe(true);
  });
});
