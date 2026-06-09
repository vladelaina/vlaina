import { describe, expect, it, vi } from 'vitest';
import {
  getBoundedTextBetween,
  isEditorTextRangeTooLarge,
  MAX_EDITOR_SELECTION_TEXT_CHARS,
} from './selectionTextLimits';

describe('selectionTextLimits', () => {
  it('bounds textBetween reads to the configured selection limit', () => {
    const textBetween = vi.fn(() => 'bounded');
    const doc = {
      content: { size: MAX_EDITOR_SELECTION_TEXT_CHARS + 100 },
      textBetween,
    };

    expect(getBoundedTextBetween(doc, 0, doc.content.size, '\n', '\n')).toBe('bounded');
    expect(textBetween).toHaveBeenCalledWith(0, MAX_EDITOR_SELECTION_TEXT_CHARS, '\n', '\n');
  });

  it('detects oversized editor text ranges', () => {
    expect(isEditorTextRangeTooLarge(10, 10 + MAX_EDITOR_SELECTION_TEXT_CHARS)).toBe(false);
    expect(isEditorTextRangeTooLarge(10, 11 + MAX_EDITOR_SELECTION_TEXT_CHARS)).toBe(true);
  });
});
