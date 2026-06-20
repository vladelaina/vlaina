import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES,
  createEditableMarkdownBlankLineDecorations,
  findEditableMarkdownBlankLineElement,
  handleMarkdownBlankLineKeyboardNavigation,
  isEditableMarkdownBlankLineNode,
  resolveMarkdownBlankLineTargetAtCoords,
  resolveMarkdownBlankLineNodePos,
} from './markdownBlankLineInteraction';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  return editor;
}

function replaceDocument(view: EditorView, nodes: ProseNode[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function replaceWithBlankLineDocument(view: EditorView): void {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  const htmlBlockType = schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) {
    throw new Error('Expected paragraph and html_block schema nodes');
  }

  replaceDocument(view, [
    paragraphType.create(null, schema.text('Alpha')),
    htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE }),
    paragraphType.create(null, schema.text('Beta')),
  ]);
}

function createEditableBlankLineParagraph(view: EditorView): ProseNode {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  if (!paragraphType) {
    throw new Error('Expected paragraph schema node');
  }

  return paragraphType.create(null, schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER));
}

function replaceWithEditableBlankLineDocument(view: EditorView): void {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  if (!paragraphType) {
    throw new Error('Expected paragraph schema node');
  }

  replaceDocument(view, [
    paragraphType.create(null, schema.text('Alpha')),
    createEditableBlankLineParagraph(view),
    paragraphType.create(null, schema.text('Beta')),
  ]);
}

function replaceWithListAndEditableBlankLineDocument(view: EditorView): void {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  const listItemType = schema.nodes.list_item;
  const bulletListType = schema.nodes.bullet_list;
  if (!paragraphType || !listItemType || !bulletListType) {
    throw new Error('Expected list schema nodes');
  }

  replaceDocument(view, [
    bulletListType.create(null, [
      listItemType.create(null, [
        paragraphType.create(null, schema.text('List item')),
      ]),
    ]),
    createEditableBlankLineParagraph(view),
    paragraphType.create(null, schema.text('Beta')),
  ]);
}

function replaceWithPersistedAndEditableBlankLineDocument(view: EditorView): void {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  const htmlBlockType = schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) {
    throw new Error('Expected paragraph and html_block schema nodes');
  }

  replaceDocument(view, [
    paragraphType.create(null, schema.text('Alpha')),
    htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE }),
    createEditableBlankLineParagraph(view),
    paragraphType.create(null, schema.text('Beta')),
  ]);
}

function createBlockquote(view: EditorView, text: string): ProseNode {
  const { schema } = view.state;
  const paragraphType = schema.nodes.paragraph;
  const blockquoteType = schema.nodes.blockquote;
  if (!paragraphType || !blockquoteType) {
    throw new Error('Expected paragraph and blockquote schema nodes');
  }

  return blockquoteType.create(null, paragraphType.create(null, schema.text(text)));
}

function createMarkdownBlankLine(view: EditorView): ProseNode {
  const htmlBlockType = view.state.schema.nodes.html_block;
  if (!htmlBlockType) {
    throw new Error('Expected html_block schema node');
  }

  return htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE });
}

function replaceWithBlankLineBeforeBlockquoteDocument(view: EditorView): void {
  replaceDocument(view, [
    createMarkdownBlankLine(view),
    createBlockquote(view, 'Quote'),
  ]);
}

function replaceWithBlankLineAfterBlockquoteDocument(view: EditorView): void {
  replaceDocument(view, [
    createBlockquote(view, 'Quote'),
    createMarkdownBlankLine(view),
  ]);
}

function topLevelNodePos(view: EditorView, matcher: (node: ProseNode) => boolean): number {
  let found: number | null = null;
  view.state.doc.forEach((node, offset) => {
    if (found !== null || !matcher(node)) return;
    found = offset;
  });
  if (found === null) {
    throw new Error('Expected matching top-level node');
  }
  return found;
}

function createArrowEvent(key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
}

function blockquoteTextStartPos(view: EditorView): number {
  const blockquotePos = topLevelNodePos(view, (node) => node.type.name === 'blockquote');
  return blockquotePos + 2;
}

describe('markdownBlankLineInteraction', () => {
  it('caches editable markdown blank line decorations for the same doc instance', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    const first = createEditableMarkdownBlankLineDecorations(view.state.doc);
    const second = createEditableMarkdownBlankLineDecorations(view.state.doc);

    expect(second).toBe(first);

    await editor.destroy();
  });

  it('detects editable blank line nodes without aggregating paragraph textContent', () => {
    const paragraph = {
      content: { size: EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length },
      nodeSize: 3,
      textBetween: vi.fn(() => EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER),
      type: { name: 'paragraph' },
      get textContent() {
        throw new Error('aggregate paragraph textContent should not be read');
      },
    };

    expect(isEditableMarkdownBlankLineNode(paragraph)).toBe(true);
    expect(paragraph.textBetween).toHaveBeenCalledWith(0, EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length, '\0', '\0');
  });

  it('finds editable blank line paragraphs without materializing all root children', () => {
    const root = document.createElement('div');
    root.appendChild(document.createElement('div'));
    const blankLine = document.createElement('p');
    blankLine.textContent = EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER;
    root.appendChild(blankLine);

    const arrayFrom = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used for root children');
    });

    const result = findEditableMarkdownBlankLineElement(root);
    arrayFrom.mockRestore();

    expect(result).toBe(blankLine);
  });

  it('resolves pointer-events-none markdown blank line targets by click coordinates', () => {
    const root = document.createElement('div');
    const firstBlankLine = document.createElement('div');
    firstBlankLine.setAttribute('data-type', 'html-block');
    firstBlankLine.setAttribute('data-value', MARKDOWN_BLANK_LINE_VALUE);
    const secondBlankLine = document.createElement('div');
    secondBlankLine.setAttribute('data-type', 'html-block');
    secondBlankLine.setAttribute('data-value', MARKDOWN_BLANK_LINE_VALUE);
    root.append(firstBlankLine, secondBlankLine);
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this === firstBlankLine) {
        return {
          x: 10,
          y: 20,
          top: 20,
          left: 10,
          right: 310,
          bottom: 44,
          width: 300,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this === secondBlankLine) {
        return {
          x: 10,
          y: 60,
          top: 60,
          left: 10,
          right: 310,
          bottom: 84,
          width: 300,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    try {
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 32)).toBe(firstBlankLine);
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 72)).toBe(secondBlankLine);
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 120)).toBeNull();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('stops fallback document scanning after resolving the matching blank line DOM node', () => {
    const blankLine = document.createElement('div');
    const otherBlankLine = document.createElement('div');
    const accessedChildren: number[] = [];
    const nodes = [
      {
        attrs: {},
        nodeSize: 2,
        type: { name: 'paragraph' },
      },
      {
        attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
        nodeSize: 1,
        type: { name: 'html_block' },
      },
      {
        attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
        nodeSize: 1,
        type: { name: 'html_block' },
      },
    ];
    const doc = {
      child(index: number) {
        accessedChildren.push(index);
        if (index >= 2) {
          throw new Error('Document scan should stop after the matching node');
        }
        return nodes[index];
      },
      childCount: nodes.length,
      nodeAt: vi.fn(),
    };
    const view = {
      nodeDOM(pos: number) {
        return pos === 2 ? blankLine : otherBlankLine;
      },
      posAtDOM: vi.fn(() => {
        throw new Error('Force fallback scan');
      }),
      state: { doc },
    };

    expect(resolveMarkdownBlankLineNodePos(view as any, blankLine)).toBe(2);
    expect(accessedChildren).toEqual([0, 1]);
  });

  it('caps fallback blank line node position scans by node count', () => {
    const blankLine = document.createElement('div');
    let accessed = 0;
    const doc = {
      child(index: number) {
        accessed += 1;
        if (index < MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES) {
          return {
            attrs: {},
            nodeSize: 1,
            type: { name: 'paragraph' },
          };
        }
        return {
          attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
          nodeSize: 1,
          type: { name: 'html_block' },
        };
      },
      childCount: MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES + 1,
      nodeAt: vi.fn(),
    };
    const view = {
      nodeDOM: vi.fn(() => blankLine),
      posAtDOM: vi.fn(() => {
        throw new Error('Force fallback scan');
      }),
      state: { doc },
    };

    expect(resolveMarkdownBlankLineNodePos(view as any, blankLine)).toBeNull();
    expect(accessed).toBe(MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES);
    expect(view.nodeDOM).not.toHaveBeenCalled();
  });

  it('converts an adjacent markdown blank line to an editable paragraph on ArrowDown instead of selecting the block', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithBlankLineDocument(view);
      const firstParagraphPos = topLevelNodePos(view, (node) => node.type.name === 'paragraph' && node.textContent === 'Alpha');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstParagraphPos + 1 + 'Alpha'.length)));

      const event = createArrowEvent('ArrowDown');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.child(1).type.name).toBe('paragraph');
      expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));
    } finally {
      await editor.destroy();
    }
  });

  it('converts an adjacent markdown blank line to an editable paragraph on ArrowUp instead of selecting the block', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithBlankLineDocument(view);
      const betaParagraphPos = topLevelNodePos(view, (node) => node.type.name === 'paragraph' && node.textContent === 'Beta');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, betaParagraphPos + 1)));

      const event = createArrowEvent('ArrowUp');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.child(1).type.name).toBe('paragraph');
      expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));
    } finally {
      await editor.destroy();
    }
  });

  it('converts a markdown blank line before a blockquote on ArrowLeft from the quote start', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithBlankLineBeforeBlockquoteDocument(view);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, blockquoteTextStartPos(view))));

      const event = createArrowEvent('ArrowLeft');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.child(0).type.name).toBe('paragraph');
      expect(view.state.doc.child(0).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(0));
    } finally {
      await editor.destroy();
    }
  });

  it('converts a markdown blank line after a blockquote on ArrowRight from the quote end', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithBlankLineAfterBlockquoteDocument(view);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(
        view.state.doc,
        blockquoteTextStartPos(view) + 'Quote'.length,
      )));

      const event = createArrowEvent('ArrowRight');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.child(1).type.name).toBe('paragraph');
      expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));
    } finally {
      await editor.destroy();
    }
  });

  it('moves from an editable markdown blank line to the previous paragraph end on ArrowUp', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithEditableBlankLineDocument(view);
      const blankLinePos = topLevelNodePos(
        view,
        (node) => node.type.name === 'paragraph' && node.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
      );
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(
          view.state.doc,
          blankLinePos + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length,
        )),
      );

      const event = createArrowEvent('ArrowUp');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.selection.$from.parent.textContent).toBe('Alpha');
      expect(view.state.selection.$from.parentOffset).toBe('Alpha'.length);
    } finally {
      await editor.destroy();
    }
  });

  it('moves from an editable markdown blank line to the next paragraph start on ArrowDown', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithEditableBlankLineDocument(view);
      const blankLinePos = topLevelNodePos(
        view,
        (node) => node.type.name === 'paragraph' && node.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
      );
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, blankLinePos + 1)));

      const event = createArrowEvent('ArrowDown');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.selection.$from.parent.textContent).toBe('Beta');
      expect(view.state.selection.$from.parentOffset).toBe(0);
    } finally {
      await editor.destroy();
    }
  });

  it('moves from an editable markdown blank line to the previous list item end on ArrowUp', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithListAndEditableBlankLineDocument(view);
      const blankLinePos = topLevelNodePos(
        view,
        (node) => node.type.name === 'paragraph' && node.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
      );
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(
          view.state.doc,
          blankLinePos + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length,
        )),
      );

      const event = createArrowEvent('ArrowUp');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.selection.$from.parent.textContent).toBe('List item');
      expect(view.state.selection.$from.parentOffset).toBe('List item'.length);
    } finally {
      await editor.destroy();
    }
  });

  it('moves from an editable markdown blank line into an adjacent persisted blank line on ArrowUp', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    try {
      replaceWithPersistedAndEditableBlankLineDocument(view);
      const blankLinePos = topLevelNodePos(
        view,
        (node) => node.type.name === 'paragraph' && node.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
      );
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(
          view.state.doc,
          blankLinePos + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length,
        )),
      );

      const event = createArrowEvent('ArrowUp');
      const handled = handleMarkdownBlankLineKeyboardNavigation(view, event);

      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.child(1).type.name).toBe('paragraph');
      expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));
    } finally {
      await editor.destroy();
    }
  });
});
