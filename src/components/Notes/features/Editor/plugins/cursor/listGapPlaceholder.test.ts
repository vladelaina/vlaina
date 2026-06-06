import { describe, expect, it, vi } from 'vitest';
import {
  MAX_LIST_GAP_TEXT_HIT_CHARS,
  resolvePointInsideActualText,
} from './listGapPlaceholder';

describe('listGapPlaceholder', () => {
  it('skips text hit measurement for oversized blocks', () => {
    const root = document.createElement('p');
    root.textContent = 'a'.repeat(MAX_LIST_GAP_TEXT_HIT_CHARS + 1);
    const createTreeWalkerSpy = vi.spyOn(document, 'createTreeWalker');

    expect(resolvePointInsideActualText(root, 0, 0)).toBeNull();
    expect(createTreeWalkerSpy).not.toHaveBeenCalled();
  });
});
