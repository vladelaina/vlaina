import { describe, expect, it, vi } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import * as ProseState from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  MAX_APPLIED_PREVIEW_CODE_BLOCK_SCAN_NODES,
  addProseMirrorTrailingBreaks,
  collectAppliedPreviewElements,
  getPreviewCodeBlockNodes,
  renderAppliedPreviewDocument,
} from './appliedPreviewState';

type FakePreviewNode = {
  child?: (index: number) => FakePreviewNode | null | undefined;
  childCount?: number;
  content?: { size?: number };
  nodeSize?: number;
  type?: { name?: string };
};

function createFakePreviewNode(type: string): FakePreviewNode {
  return {
    childCount: 0,
    content: { size: 0 },
    nodeSize: 1,
    type: { name: type },
  };
}

function createFakePreviewDoc(children: FakePreviewNode[], onAccess?: () => void): FakePreviewNode {
  return {
    child(index) {
      onAccess?.();
      return children[index];
    },
    childCount: children.length,
    content: {
      size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
    },
    type: { name: 'doc' },
  };
}

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

  it('stops collecting preview code block nodes after the expected count', () => {
    let accessed = 0;
    const doc = createFakePreviewDoc([
      createFakePreviewNode('code_block'),
      createFakePreviewNode('paragraph'),
      createFakePreviewNode('code_block'),
    ], () => {
      accessed += 1;
    });

    const codeBlocks = getPreviewCodeBlockNodes({ doc } as any, 1);

    expect(codeBlocks).toHaveLength(1);
    expect(accessed).toBe(1);
  });

  it('returns null when fewer preview code block nodes are found than expected', () => {
    const doc = createFakePreviewDoc([
      createFakePreviewNode('paragraph'),
      createFakePreviewNode('code_block'),
    ]);

    expect(getPreviewCodeBlockNodes({ doc } as any, 2)).toBeNull();
  });

  it('returns null when preview code block node scans exceed the budget', () => {
    let accessed = 0;
    const doc = createFakePreviewDoc([
      ...Array.from(
        { length: MAX_APPLIED_PREVIEW_CODE_BLOCK_SCAN_NODES },
        () => createFakePreviewNode('paragraph')
      ),
      createFakePreviewNode('code_block'),
    ], () => {
      accessed += 1;
    });

    expect(getPreviewCodeBlockNodes({ doc } as any, 1)).toBeNull();
    expect(accessed).toBe(MAX_APPLIED_PREVIEW_CODE_BLOCK_SCAN_NODES);
  });

  it('renders applied preview preservation paths without broad DOM selector scans', () => {
    const SchemaCtor = (ProseModel as any).Schema;
    const EditorStateCtor = (ProseState as any).EditorState;
    const schema = new SchemaCtor({
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
          toDOM: (node: ProseNode) => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
        },
        frontmatter: {
          content: 'text*',
          group: 'block',
          toDOM: () => ['div', { 'data-type': 'frontmatter', class: 'frontmatter-block-container' }, 0],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
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

  it('bounds trailing break synchronization for oversized preview documents', () => {
    const previewDom = document.createElement('div');
    const maxNodes = 3;
    for (let index = 0; index < maxNodes + 2; index += 1) {
      previewDom.appendChild(document.createElement('p'));
    }
    const emptyParagraph = {
      childCount: 0,
      content: { size: 0 },
      isTextblock: true,
      nodeSize: 2,
    };
    const doc = {
      child: vi.fn(() => emptyParagraph),
      childCount: maxNodes + 2,
    };

    addProseMirrorTrailingBreaks(previewDom, doc as any, document, { maxNodes });

    expect(previewDom.querySelectorAll('.ProseMirror-trailingBreak')).toHaveLength(maxNodes);
  });
});
