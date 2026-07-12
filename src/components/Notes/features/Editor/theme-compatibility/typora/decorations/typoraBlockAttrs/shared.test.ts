import { describe, expect, it } from 'vitest';
import { isInternalBlankLineHtmlBlock } from './shared';

describe('typora block attr shared helpers', () => {
  it('treats editor-only blank line html blocks as ignorable layout placeholders', () => {
    for (const value of [
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
    ]) {
      expect(isInternalBlankLineHtmlBlock({
        type: { name: 'html_block' },
        attrs: { value },
      })).toBe(true);
    }
  });
});
