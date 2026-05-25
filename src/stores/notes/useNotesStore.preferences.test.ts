import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from './useNotesStore';
import { NOTE_ICON_SIZE_KEY, RECENT_NOTES_KEY } from './constants';

describe('useNotesStore note preferences sync', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotesStore.setState({ noteIconSize: 60, recentNotes: [] });
  });

  it('reloads the global note icon size after a cross-window storage update', () => {
    localStorage.setItem(NOTE_ICON_SIZE_KEY, '84');

    window.dispatchEvent(new StorageEvent('storage', {
      key: NOTE_ICON_SIZE_KEY,
      newValue: '84',
    }));

    expect(useNotesStore.getState().noteIconSize).toBe(84);
  });

  it('reloads recent notes after a cross-window storage update', () => {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(['docs/a.md', 'docs/b.md']));

    window.dispatchEvent(new StorageEvent('storage', {
      key: RECENT_NOTES_KEY,
      newValue: JSON.stringify(['docs/a.md', 'docs/b.md']),
    }));

    expect(useNotesStore.getState().recentNotes).toEqual(['docs/a.md', 'docs/b.md']);
  });
});
