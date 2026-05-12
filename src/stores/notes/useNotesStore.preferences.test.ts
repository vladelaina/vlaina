import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from './useNotesStore';
import { NOTE_ICON_SIZE_KEY } from './constants';

describe('useNotesStore note preferences sync', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotesStore.setState({ noteIconSize: 60 });
  });

  it('reloads the global note icon size after a cross-window storage update', () => {
    localStorage.setItem(NOTE_ICON_SIZE_KEY, '84');

    window.dispatchEvent(new StorageEvent('storage', {
      key: NOTE_ICON_SIZE_KEY,
      newValue: '84',
    }));

    expect(useNotesStore.getState().noteIconSize).toBe(84);
  });
});
