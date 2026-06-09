import { describe, expect, it } from 'vitest';
import {
  MAX_CHAT_PASTE_MULTILINE_SCAN_CHARS,
  shouldMarkPastedTextMultiline,
} from './chatPasteText';

describe('shouldMarkPastedTextMultiline', () => {
  it('keeps small single-line paste content compact', () => {
    expect(shouldMarkPastedTextMultiline('hello world')).toBe(false);
  });

  it('marks small pasted content with a newline as multiline', () => {
    expect(shouldMarkPastedTextMultiline('hello\nworld')).toBe(true);
  });

  it('marks oversized pasted content as multiline without requiring a full newline scan', () => {
    expect(shouldMarkPastedTextMultiline('x'.repeat(MAX_CHAT_PASTE_MULTILINE_SCAN_CHARS + 1))).toBe(true);
  });
});
