import { describe, expect, it, vi } from 'vitest';
import {
  isListGapPlaceholderParagraph,
  MAX_LIST_GAP_PLACEHOLDER_TEXT_CHARS,
  MAX_LIST_GAP_TEXT_HIT_CHARS,
  resolvePointInsideActualText,
} from './listGapPlaceholder';

describe('listGapPlaceholder', () => {
  it('skips text hit measurement for oversized blocks without reading aggregate text', () => {
    const root = document.createElement('p');
    root.append(document.createTextNode('a'.repeat(MAX_LIST_GAP_TEXT_HIT_CHARS + 1)));
    const createRangeSpy = vi.spyOn(document, 'createRange');
    Object.defineProperty(root, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate textContent should not be read');
      },
    });

    expect(resolvePointInsideActualText(root, 0, 0)).toBeNull();
    expect(createRangeSpy).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('checks placeholder paragraphs without reading aggregate ProseMirror text', () => {
    const node = {
      type: { name: 'paragraph' },
      content: { size: 1 },
      textBetween: vi.fn(() => '\u2800'),
      get textContent() {
        throw new Error('aggregate textContent should not be read');
      },
    };

    expect(isListGapPlaceholderParagraph(node)).toBe(true);
    expect(node.textBetween).toHaveBeenCalledWith(0, 1, '', '');
  });

  it('skips oversized placeholder paragraph candidates', () => {
    const node = {
      type: { name: 'paragraph' },
      content: { size: MAX_LIST_GAP_PLACEHOLDER_TEXT_CHARS + 1 },
      textBetween: vi.fn(() => '\u2800'),
    };

    expect(isListGapPlaceholderParagraph(node)).toBe(false);
    expect(node.textBetween).not.toHaveBeenCalled();
  });
});
