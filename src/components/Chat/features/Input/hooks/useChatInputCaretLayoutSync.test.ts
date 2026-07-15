import { describe, expect, it } from 'vitest';
import { shouldRefocusMovedCaret } from './useChatInputCaretLayoutSync';

describe('shouldRefocusMovedCaret', () => {
  const initial = { height: 24, left: 100, top: 500 };

  it('detects a focused textarea moved by content inserted before it', () => {
    expect(shouldRefocusMovedCaret(
      initial,
      { ...initial, top: 550 },
      true,
      false,
    )).toBe(true);
  });

  it('ignores normal textarea growth while typing', () => {
    expect(shouldRefocusMovedCaret(
      initial,
      { ...initial, height: 48, top: 476 },
      true,
      false,
    )).toBe(false);
  });

  it('does not interrupt composition or an unfocused textarea', () => {
    const moved = { ...initial, top: 550 };
    expect(shouldRefocusMovedCaret(initial, moved, true, true)).toBe(false);
    expect(shouldRefocusMovedCaret(initial, moved, false, false)).toBe(false);
  });
});
