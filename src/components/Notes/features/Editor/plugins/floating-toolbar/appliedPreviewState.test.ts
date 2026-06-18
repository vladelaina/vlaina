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
    sourceListItem!.classList.add('HyperMD-list-line', 'cm-line', 'md-task-list-item');
    sourceListItem!.setAttribute('data-task', ' ');
    sourceListItem!.setAttribute('aria-checked', 'false');
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
    expect(previewListItem?.classList.contains('HyperMD-list-line')).toBe(true);
    expect(previewListItem?.classList.contains('md-task-list-item')).toBe(true);
    expect(previewListItem?.getAttribute('data-task')).toBe(' ');
    expect(previewListItem?.getAttribute('aria-checked')).toBe('false');
    expect(previewDom!.querySelector('.editor-collapsed-content')).toBeInstanceOf(HTMLElement);
    expect(previewDom!.querySelector('.image-block-container button')?.hasAttribute('tabindex')).toBe(false);
    expect(previewDom!.querySelector('.frontmatter-block-container [contenteditable]')).toBeNull();
  });

  it('preserves image block layout when the serialized preview contains other images', () => {
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
        html_block: {
          atom: true,
          group: 'block',
          toDOM: () => ['div', { 'data-type': 'html-block' }, ['img', { src: 'raw.png', alt: 'raw' }]],
        },
        image: {
          inline: true,
          group: 'inline',
          atom: true,
          attrs: {
            src: { default: '' },
            alt: { default: '' },
            align: { default: 'center' },
            width: { default: '' },
          },
          toDOM: (node: ProseNode) => ['img', {
            src: node.attrs.src,
            alt: node.attrs.alt,
            align: node.attrs.align,
            width: node.attrs.width,
            'data-src': node.attrs.src,
          }],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('html_block'),
        schema.node('paragraph', null, [
          schema.node('image', {
            src: 'image.png',
            alt: 'preview',
            align: 'center',
            width: '72%',
          }),
        ]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    const rawBlock = document.createElement('div');
    rawBlock.dataset.type = 'html-block';
    rawBlock.innerHTML = '<img src="raw.png" alt="raw">';
    const sourceParagraph = document.createElement('p');
    sourceParagraph.className = 'editor-paragraph-has-image-block';
    sourceParagraph.style.lineHeight = '0px';
    sourceParagraph.style.marginBottom = '16px';
    sourceParagraph.style.marginTop = '16px';
    const sourceImageBlock = document.createElement('div');
    sourceImageBlock.className = 'image-block-container md-image image-embed';
    sourceImageBlock.dataset.src = 'image.png';
    sourceImageBlock.dataset.alt = 'preview';
    sourceImageBlock.dataset.align = 'center';
    sourceImageBlock.dataset.width = '72%';
    sourceImageBlock.setAttribute('src', 'image.png');
    sourceImageBlock.setAttribute('align', 'center');
    sourceImageBlock.setAttribute('width', '72%');
    sourceImageBlock.innerHTML = [
      '<div class="w-full flex group/image justify-center">',
      '<div class="relative flex flex-col leading-none" style="width: 72%; line-height: 0px;">',
      '<img src="blob:resolved-image" data-src="image.png" alt="preview">',
      '<button tabindex="0">Resize</button>',
      '</div>',
      '</div>',
    ].join('');
    sourceParagraph.appendChild(sourceImageBlock);
    sourceDom.append(rawBlock, sourceParagraph);

    const previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    const previewImageBlock = previewDom.querySelector<HTMLElement>('.image-block-container');
    const previewParagraph = previewImageBlock?.closest('p');

    expect(previewDom.querySelector('div[data-type="html-block"] img')?.getAttribute('src')).toBe('raw.png');
    expect(previewDom.querySelector('p > img[src="image.png"]')).toBeNull();
    expect(previewImageBlock).toBeInstanceOf(HTMLElement);
    expect(previewImageBlock?.querySelector('img')?.getAttribute('src')).toBe('blob:resolved-image');
    expect(previewImageBlock?.querySelector('.justify-center')).toBeInstanceOf(HTMLElement);
    expect(previewImageBlock?.querySelector('button')?.hasAttribute('tabindex')).toBe(false);
    expect(previewParagraph?.classList.contains('editor-paragraph-has-image-block')).toBe(true);
    expect(previewParagraph?.style.lineHeight).toBe('0px');
    expect(previewParagraph?.style.marginTop).toBe('16px');
    expect(previewParagraph?.style.marginBottom).toBe('16px');
  });

  it('keeps image block spacing to adjacent paragraphs in applied previews', () => {
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
        image: {
          inline: true,
          group: 'inline',
          atom: true,
          attrs: {
            src: { default: '' },
            alt: { default: '' },
            align: { default: 'center' },
            width: { default: '' },
          },
          toDOM: (node: ProseNode) => ['img', {
            src: node.attrs.src,
            alt: node.attrs.alt,
            align: node.attrs.align,
            width: node.attrs.width,
            'data-src': node.attrs.src,
          }],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('paragraph', null, [
          schema.node('image', {
            src: 'catalog.png#w=66.38%25',
            alt: 'catalog',
            align: 'center',
            width: '72%',
          }),
        ]),
        schema.node('paragraph', null, [schema.text('After image paragraph')]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    const sourceImageParagraph = document.createElement('p');
    sourceImageParagraph.className = 'md-p cm-line editor-paragraph-has-image-block';
    sourceImageParagraph.style.marginBottom = '24px';
    const sourceImageBlock = document.createElement('div');
    sourceImageBlock.className = 'image-block-container md-image image-embed';
    sourceImageBlock.dataset.src = 'catalog.png#w=66.38%25';
    sourceImageBlock.dataset.alt = 'catalog';
    sourceImageBlock.dataset.align = 'center';
    sourceImageBlock.dataset.width = '72%';
    sourceImageBlock.setAttribute('src', 'catalog.png#w=66.38%25');
    sourceImageBlock.setAttribute('align', 'center');
    sourceImageBlock.setAttribute('width', '72%');
    sourceImageBlock.innerHTML = '<img src="blob:catalog" data-src="catalog.png#w=66.38%25" alt="catalog">';
    sourceImageParagraph.append(sourceImageBlock);
    const sourceTextParagraph = document.createElement('p');
    sourceTextParagraph.className = 'md-p cm-line';
    sourceTextParagraph.style.lineHeight = '29px';
    sourceTextParagraph.style.marginTop = '18px';
    sourceTextParagraph.textContent = 'After image paragraph';
    sourceDom.append(sourceImageParagraph, sourceTextParagraph);

    const previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    const previewImageBlock = previewDom.querySelector<HTMLElement>('.image-block-container');
    const previewImageParagraph = previewImageBlock?.closest('p');
    const previewTextParagraph = Array.from(previewDom.querySelectorAll<HTMLElement>('p'))
      .find((paragraph) => paragraph.textContent?.includes('After image paragraph')) ?? null;

    expect(previewImageBlock).toBeInstanceOf(HTMLElement);
    expect(previewImageParagraph?.classList.contains('editor-paragraph-has-image-block')).toBe(true);
    expect(previewImageParagraph?.style.marginBottom).toBe('24px');
    expect(previewTextParagraph?.classList.contains('md-p')).toBe(true);
    expect(previewTextParagraph?.classList.contains('cm-line')).toBe(true);
    expect(previewTextParagraph?.style.lineHeight).toBe('29px');
    expect(previewTextParagraph?.style.marginTop).toBe('18px');
  });

  it('keeps raw html media block spacing to adjacent paragraphs in applied previews', () => {
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
        html_block: {
          atom: true,
          group: 'block',
          attrs: { value: { default: '' } },
          toDOM: () => ['div', { 'data-type': 'html-block' }, ['img', { src: 'catalog.png', alt: 'catalog' }]],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('html_block', { value: '<img src="catalog.png" alt="catalog" width="72%" />' }),
        schema.node('paragraph', null, [schema.text('After raw html image')]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    const sourceHtmlBlock = document.createElement('div');
    sourceHtmlBlock.className = 'md-htmlblock md-htmlblock-container v-caption iframe vlook-media-html-block';
    sourceHtmlBlock.dataset.type = 'html-block';
    sourceHtmlBlock.style.marginBottom = '21px';
    sourceHtmlBlock.style.minHeight = '40px';
    sourceHtmlBlock.innerHTML = '<img src="catalog.png" alt="catalog" width="72%">';
    const sourceTextParagraph = document.createElement('p');
    sourceTextParagraph.className = 'md-p cm-line';
    sourceTextParagraph.style.marginTop = '15px';
    sourceTextParagraph.textContent = 'After raw html image';
    sourceDom.append(sourceHtmlBlock, sourceTextParagraph);

    const previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    const previewHtmlBlock = previewDom.querySelector<HTMLElement>('[data-type="html-block"]');
    const previewTextParagraph = Array.from(previewDom.querySelectorAll<HTMLElement>('p'))
      .find((paragraph) => paragraph.textContent?.includes('After raw html image')) ?? null;

    expect(previewHtmlBlock?.classList.contains('md-htmlblock')).toBe(true);
    expect(previewHtmlBlock?.classList.contains('vlook-media-html-block')).toBe(true);
    expect(previewHtmlBlock?.classList.contains('iframe')).toBe(true);
    expect(previewHtmlBlock?.style.marginBottom).toBe('21px');
    expect(previewHtmlBlock?.style.minHeight).toBe('40px');
    expect(previewTextParagraph?.classList.contains('md-p')).toBe(true);
    expect(previewTextParagraph?.classList.contains('cm-line')).toBe(true);
    expect(previewTextParagraph?.style.marginTop).toBe('15px');
  });

  it('keeps markdown blank-line layout stable in applied previews', () => {
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
        html_block: {
          atom: true,
          group: 'block',
          attrs: { value: { default: '' } },
          toDOM: (node: ProseNode) => ['div', {
            'data-type': 'html-block',
            'data-value': node.attrs.value,
          }],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('paragraph', null, [schema.text('Before')]),
        schema.node('html_block', { value: '<!--vlaina-markdown-blank-line-->' }),
        schema.node('paragraph'),
        schema.node('paragraph', null, [schema.text('After')]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    const sourceBefore = document.createElement('p');
    sourceBefore.textContent = 'Before';
    const sourceHtmlBlankLine = document.createElement('div');
    sourceHtmlBlankLine.dataset.type = 'html-block';
    sourceHtmlBlankLine.dataset.value = '<!--vlaina-markdown-blank-line-->';
    sourceHtmlBlankLine.style.minHeight = '24px';
    sourceHtmlBlankLine.style.marginTop = '0px';
    sourceHtmlBlankLine.style.marginBottom = '0px';
    sourceHtmlBlankLine.style.lineHeight = '24px';
    const sourceEditableBlankLine = document.createElement('p');
    sourceEditableBlankLine.className = 'editor-empty-paragraph';
    sourceEditableBlankLine.style.minHeight = '24px';
    sourceEditableBlankLine.style.marginTop = '0px';
    sourceEditableBlankLine.style.marginBottom = '0px';
    sourceEditableBlankLine.style.paddingTop = '0px';
    sourceEditableBlankLine.style.paddingBottom = '0px';
    const sourceAfter = document.createElement('p');
    sourceAfter.textContent = 'After';
    sourceDom.append(sourceBefore, sourceHtmlBlankLine, sourceEditableBlankLine, sourceAfter);

    const previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    const previewHtmlBlankLine = previewDom.children.item(1) as HTMLElement | null;
    const previewEditableBlankLine = previewDom.children.item(2) as HTMLElement | null;

    expect(previewHtmlBlankLine?.dataset.value).toBe('<!--vlaina-markdown-blank-line-->');
    expect(previewHtmlBlankLine?.style.minHeight).toBe('24px');
    expect(previewHtmlBlankLine?.style.marginTop).toBe('0px');
    expect(previewHtmlBlankLine?.style.marginBottom).toBe('0px');
    expect(previewHtmlBlankLine?.style.lineHeight).toBe('24px');
    expect(previewEditableBlankLine?.classList.contains('editor-empty-paragraph')).toBe(true);
    expect(previewEditableBlankLine?.style.minHeight).toBe('24px');
    expect(previewEditableBlankLine?.style.marginTop).toBe('0px');
    expect(previewEditableBlankLine?.style.marginBottom).toBe('0px');
    expect(previewEditableBlankLine?.style.paddingTop).toBe('0px');
    expect(previewEditableBlankLine?.style.paddingBottom).toBe('0px');
    expect(previewEditableBlankLine?.querySelector('.ProseMirror-trailingBreak')).toBeInstanceOf(HTMLBRElement);
  });

  it('mirrors top-level layout decorations that can change preview document height', () => {
    const SchemaCtor = (ProseModel as any).Schema;
    const EditorStateCtor = (ProseState as any).EditorState;
    const schema = new SchemaCtor({
      nodes: {
        doc: { content: 'block+' },
        heading: {
          content: 'text*',
          group: 'block',
          attrs: { level: { default: 1 } },
          toDOM: (node: ProseNode) => [`h${node.attrs.level}`, 0],
        },
        paragraph: {
          content: 'inline*',
          group: 'block',
          toDOM: () => ['p', 0],
        },
        blockquote: {
          content: 'block+',
          group: 'block',
          toDOM: () => ['blockquote', 0],
        },
        text: { group: 'inline' },
      },
    });
    const state = EditorStateCtor.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node('heading', { level: 2 }, [schema.text('Collapsed')]),
        schema.node('paragraph', null, [schema.text('Hidden content')]),
        schema.node('blockquote', null, [
          schema.node('paragraph', null, [schema.text('Column content')]),
        ]),
      ]),
    });
    const sourceDom = document.createElement('div');
    sourceDom.className = 'ProseMirror';
    const sourceHeading = document.createElement('h2');
    sourceHeading.textContent = 'Collapsed';
    const sourceCollapsedContent = document.createElement('p');
    sourceCollapsedContent.className = 'heading-collapsed-content';
    sourceCollapsedContent.style.display = 'none';
    sourceCollapsedContent.textContent = 'Hidden content';
    const sourceColumn = document.createElement('blockquote');
    sourceColumn.className = 'vlook-column-block vlook-column-3 vlook-column-item-2 vlook-column-quote';
    sourceColumn.style.columnCount = '3';
    sourceColumn.style.marginLeft = '32px';
    sourceColumn.innerHTML = '<p>Column content</p>';
    sourceDom.append(sourceHeading, sourceCollapsedContent, sourceColumn);

    const previewDom = renderAppliedPreviewDocument(state, sourceDom, document);
    const previewCollapsedContent = previewDom.children.item(1) as HTMLElement | null;
    const previewColumn = previewDom.children.item(2) as HTMLElement | null;

    expect(previewCollapsedContent?.classList.contains('heading-collapsed-content')).toBe(true);
    expect(previewCollapsedContent?.style.display).toBe('none');
    expect(previewColumn?.classList.contains('vlook-column-block')).toBe(true);
    expect(previewColumn?.classList.contains('vlook-column-3')).toBe(true);
    expect(previewColumn?.classList.contains('vlook-column-item-2')).toBe(true);
    expect(previewColumn?.classList.contains('vlook-column-quote')).toBe(true);
    expect(previewColumn?.style.columnCount).toBe('3');
    expect(previewColumn?.style.marginLeft).toBe('32px');
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
