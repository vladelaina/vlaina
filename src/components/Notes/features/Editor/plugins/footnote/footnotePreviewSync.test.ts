import { describe, expect, it, vi } from 'vitest';
import {
  MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS,
  readBoundedFootnotePreviewSource,
  syncFootnoteReferencePreviews,
} from './footnotePlugin';

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

  it('syncs previews without reading aggregate footnote definition text', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<p><sup class="footnote-ref" data-id="note"></sup></p>',
      '<div class="footnote-def" data-id="note"><div class="footnote-def-content">Preview text</div></div>',
    ].join('');
    const definition = root.querySelector('.footnote-def');
    const content = root.querySelector('.footnote-def-content');
    expect(definition).toBeInstanceOf(HTMLElement);
    expect(content).toBeInstanceOf(HTMLElement);
    Object.defineProperty(definition, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate definition textContent should not be read');
      },
    });
    Object.defineProperty(content, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate content textContent should not be read');
      },
    });

    syncFootnoteReferencePreviews(root);

    expect(root.querySelector('.footnote-ref')).toHaveAttribute('data-footnote-value', 'Preview text');
  });

  it('bounds raw footnote preview source reads', () => {
    const root = document.createElement('div');
    root.append(document.createTextNode('x'.repeat(MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS + 20)));

    expect(readBoundedFootnotePreviewSource(root)).toHaveLength(MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS);
  });
});
