import { describe, expect, it } from 'vitest';
import { calculateTaskCheckboxBounds } from './taskCheckboxHitArea';

describe('taskCheckboxHitArea', () => {
  it('derives checkbox bounds from the text block start', () => {
    expect(
      calculateTaskCheckboxBounds({
        textLeft: 132,
        gap: 8,
        checkboxSize: 16,
      })
    ).toEqual({
      left: 108,
      right: 124,
    });
  });

  it('supports centered or right-aligned task rows with shifted text start', () => {
    expect(
      calculateTaskCheckboxBounds({
        textLeft: 280,
        gap: 8,
        checkboxSize: 16,
      })
    ).toEqual({
      left: 256,
      right: 272,
    });
  });
});
