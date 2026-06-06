import { describe, expect, it, vi } from 'vitest';
import { syncFootnoteReferencePreviews } from './footnotePlugin';

describe('footnote preview sync', () => {
  it('does not materialize footnote refs or definitions with querySelectorAll', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<p><sup class="footnote-ref" data-id="note"></sup></p>',
      '<div class="footnote-def" data-id="note"><div class="footnote-def-content">Preview text</div></div>',
    ].join('');
    const querySelectorAllSpy = vi
      .spyOn(Element.prototype, 'querySelectorAll')
      .mockImplementation(() => {
        throw new Error('querySelectorAll should not be used for footnote preview sync');
      });

    try {
      syncFootnoteReferencePreviews(root);
    } finally {
      querySelectorAllSpy.mockRestore();
    }

    expect(root.querySelector('.footnote-ref')).toHaveAttribute('data-footnote-value', 'Preview text');
  });
});
