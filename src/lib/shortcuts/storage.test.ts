import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SHORTCUTS } from './config';
import { getShortcutKeys, resetShortcuts, saveShortcuts } from './storage';

describe('shortcut storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('does not throw when localStorage is unavailable during reset', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => resetShortcuts()).not.toThrow();
  });

  it('loads only known bounded shortcut entries from localStorage', () => {
    localStorage.setItem('vlaina-shortcuts', JSON.stringify([
      { id: 'toggleDrawer', keys: ['Alt', 'D'] },
      { id: 'unknown', keys: ['Ctrl'] },
      { id: 'saveNote', keys: ['x'.repeat(65), 'S', 7, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
    ]));

    expect(getShortcutKeys('toggleDrawer')).toEqual(['Alt', 'D']);
    expect(getShortcutKeys('saveNote')).toEqual(['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('uses non-conflicting note tab defaults', () => {
    expect(getShortcutKeys('newTab')).toEqual(['Ctrl', 'Shift', 'T']);
    expect(getShortcutKeys('reopenClosedTab')).toEqual(['Ctrl', 'Alt', 'T']);
  });

  it('ignores oversized localStorage shortcut payloads', () => {
    const defaultKeys = DEFAULT_SHORTCUTS.find((shortcut) => shortcut.id === 'toggleDrawer')?.keys;
    localStorage.setItem('vlaina-shortcuts', JSON.stringify([{ id: 'toggleDrawer', keys: ['Alt', 'D'] }]) + 'x'.repeat(32 * 1024));

    expect(getShortcutKeys('toggleDrawer')).toEqual(defaultKeys);
  });

  it('saves only known bounded shortcut entries', () => {
    saveShortcuts([
      {
        ...DEFAULT_SHORTCUTS[0]!,
        keys: ['Alt', 'D', 'x'.repeat(65), 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        ...DEFAULT_SHORTCUTS[1]!,
        id: 'unknown',
        keys: ['Ctrl'],
      },
    ]);

    expect(JSON.parse(localStorage.getItem('vlaina-shortcuts') || '[]')).toEqual([
      {
        id: DEFAULT_SHORTCUTS[0]!.id,
        keys: ['Alt', 'D', 'A', 'B', 'C', 'D', 'E', 'F'],
      },
    ]);
  });
});
