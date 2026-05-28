import { describe, expect, it } from 'vitest';
import {
  blurActiveEditableElement,
  resolveBlankAreaSelectionAutoScrollDelta,
} from './blankAreaSelectionSession';

describe('resolveBlankAreaSelectionAutoScrollDelta', () => {
  const scrollRootRect = { top: 100, bottom: 500 };

  it('does not scroll when the pointer is away from the viewport edges', () => {
    expect(resolveBlankAreaSelectionAutoScrollDelta(260, scrollRootRect)).toBe(0);
  });

  it('scrolls upward near the top edge', () => {
    expect(resolveBlankAreaSelectionAutoScrollDelta(140, scrollRootRect)).toBeLessThan(0);
    expect(resolveBlankAreaSelectionAutoScrollDelta(80, scrollRootRect)).toBe(-18);
  });

  it('scrolls downward near the bottom edge', () => {
    expect(resolveBlankAreaSelectionAutoScrollDelta(460, scrollRootRect)).toBeGreaterThan(0);
    expect(resolveBlankAreaSelectionAutoScrollDelta(520, scrollRootRect)).toBe(18);
  });
});

describe('blurActiveEditableElement', () => {
  it('blurs the focused editable element when block selection activates', () => {
    const input = document.createElement('textarea');
    document.body.appendChild(input);

    try {
      input.focus();
      expect(document.activeElement).toBe(input);

      blurActiveEditableElement(document);

      expect(document.activeElement).not.toBe(input);
    } finally {
      input.remove();
    }
  });

  it('does not blur non-editable focused surfaces', () => {
    const surface = document.createElement('div');
    surface.tabIndex = 0;
    document.body.appendChild(surface);

    try {
      surface.focus();
      expect(document.activeElement).toBe(surface);

      blurActiveEditableElement(document);

      expect(document.activeElement).toBe(surface);
    } finally {
      surface.remove();
    }
  });
});
