import { describe, expect, it } from 'vitest';
import { isPlainSlashMenuNavigationKey } from './slashKeyboard';

describe('slash menu keyboard handling', () => {
  it.each(['ArrowDown', 'ArrowUp'])('handles plain %s for menu navigation', (key) => {
    expect(isPlainSlashMenuNavigationKey(new KeyboardEvent('keydown', { key }))).toBe(true);
  });

  it.each([
    { ctrlKey: true },
    { shiftKey: true },
    { metaKey: true },
    { altKey: true },
  ])('does not handle modified arrow navigation: %o', (eventInit) => {
    expect(
      isPlainSlashMenuNavigationKey(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          ...eventInit,
        })
      )
    ).toBe(false);
  });
});
