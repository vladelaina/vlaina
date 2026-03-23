import { describe, expect, it } from 'vitest';
import { getKeysFromEvent, matchShortcut } from './matcher';

describe('shortcut matcher', () => {
  it('normalizes the backslash physical key when shift is pressed', () => {
    const event = new KeyboardEvent('keydown', {
      key: '|',
      code: 'Backslash',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
    });

    expect(getKeysFromEvent(event)).toEqual(['ctrl', 'shift', '\\']);
  });

  it('matches the notes sidebar view toggle shortcut', () => {
    const event = new KeyboardEvent('keydown', {
      key: '|',
      code: 'Backslash',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
    });

    expect(
      matchShortcut(getKeysFromEvent(event), {
        id: 'toggleNotesSidebarView',
        keys: ['Ctrl', 'Shift', '\\'],
        description: 'Toggle notes sidebar view',
        scope: 'notes',
      }),
    ).toBe(true);
  });

  it('normalizes the semicolon physical key when shift is pressed', () => {
    const event = new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
    });

    expect(getKeysFromEvent(event)).toEqual(['ctrl', 'shift', ';']);
  });
});
