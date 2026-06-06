import { describe, expect, it, vi } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState } from '@milkdown/kit/prose/state';
import {
  collectAppliedPreviewElements,
  renderAppliedPreviewDocument,
} from './appliedPreviewState';

describe('appliedPreviewState', () => {
  it('collects matched preview elements without materializing selector results', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section><span data-hit="true"></span><span></span></section>';
    const querySelectorAllSpy = vi.spyOn(root, 'querySelectorAll');
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used');
    });

    try {
      const collection = collectAppliedPreviewElements(
        root,
        (element) => element.dataset.hit === 'true'
      );

      expect(collection.complete).toBe(true);
      expect(collection.elements).toHaveLength(1);
      expect(collection.elements[0]?.dataset.hit).toBe('true');
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      arrayFromSpy.mockRestore();
      querySelectorAllSpy.mockRestore();
    }
  });

  it('stops collecting when the preview DOM scan budget is exceeded', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span></span><span></span>';

    const collection = collectAppliedPreviewElements(root, () => true, { maxScanned: 1 });

    expect(collection).toEqual({ complete: false, elements: [] });
  });

  it('renders applied preview preservation paths without broad DOM selector scans', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          toDOM: () => ['p', 0],
        },
        bullet_list: {
          content: 'list_item+',
          group: 'block',
          toDOM: () => ['ul', 0],
        },
        list_item: {
          content: 'paragraph bullet_list?',
          toDOM: () => ['li', 0],
        },
        image: {
          inline: true,
          group: 'inline',
          atom: true,
          attrs: { src: { default: '' }, alt: { default: '' } },
          toDOM: (node) => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
        },
        frontmatter: {
          content: 'text*',
          group: 'block',
          toDOM: () => ['div', { 'data-type': 'frontmatter', class: 'frontmatter-block-container' }, 0],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorState.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', null, [schema.text('parent')]),
            schema.node('bullet_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', null, [schema.text('child')]),
              ]),
            ]),
          ]),
        ]),
        schema.node('paragraph', null, [
          schema.node('image', { src: 'image.png', alt: 'preview' }),
        ]),
        schema.node('frontmatter', null, [schema.text('title: Test')]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    sourceDom.innerHTML = [
      '<ul><li><p>parent</p><ul class="editor-collapsed-content"><li><p>child</p></li></ul></li></ul>',
      '<p><span class="image-block-container"><img src="resolved-image.png" alt="preview"><button tabindex="0">Resize</button></span></p>',
      '<div data-type="frontmatter" class="frontmatter-block-container"><div contenteditable="true" tabindex="0">title: Test</div></div>',
    ].join('');
    const sourceListItem = sourceDom.querySelector<HTMLElement>('li');
    expect(sourceListItem).toBeInstanceOf(HTMLElement);
    sourceListItem!.style.lineHeight = '32px';

    const querySelectorAllSpy = vi.spyOn(Element.prototype, 'querySelectorAll').mockImplementation(() => {
      throw new Error('querySelectorAll should not be used');
    });

    let previewDom: HTMLElement;
    try {
      previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    } finally {
      querySelectorAllSpy.mockRestore();
    }

    const previewListItem = previewDom!.querySelector<HTMLElement>('li');
    expect(previewListItem?.style.lineHeight).toBe('32px');
    expect(previewDom!.querySelector('.editor-collapsed-content')).toBeInstanceOf(HTMLElement);
    expect(previewDom!.querySelector('.image-block-container button')?.hasAttribute('tabindex')).toBe(false);
    expect(previewDom!.querySelector('.frontmatter-block-container [contenteditable]')).toBeNull();
  });
});
