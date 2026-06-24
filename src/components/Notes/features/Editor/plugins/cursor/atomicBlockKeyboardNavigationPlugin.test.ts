import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { baseKeymap } from '@milkdown/kit/prose/commands';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { calloutPlugin } from '../callout';
import { codeBlockPlugins } from '../code';
import { footnotePlugin } from '../footnote';
import { frontmatterPlugin } from '../frontmatter';
import { mathPlugin } from '../math';
import { mermaidPlugin } from '../mermaid';
import { tocPlugin } from '../toc';
import { videoPlugin } from '../video';
import { createTableNodeFromPipeCells } from '../table/pipeTableShortcut';
import {
  ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS,
  atomicBlockKeyboardNavigationPlugin,
} from './atomicBlockKeyboardNavigationPlugin';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE,
} from './markdownBlankLineInteraction';

function createEditor(markdown = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(calloutPlugin)
    .use(footnotePlugin)
    .use(frontmatterPlugin)
    .use(mathPlugin)
    .use(mermaidPlugin)
    .use(tocPlugin)
    .use(videoPlugin)
    .use(atomicBlockKeyboardNavigationPlugin);
}

function createEditorWithCodeKeymap(markdown = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(calloutPlugin)
    .use(footnotePlugin)
    .use(frontmatterPlugin)
    .use(mathPlugin)
    .use(mermaidPlugin)
    .use(tocPlugin)
    .use(videoPlugin)
    .use(codeBlockPlugins)
    .use(atomicBlockKeyboardNavigationPlugin);
}

function replaceDocument(view: EditorView, nodes: ProseNode[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function topLevelNodePos(view: EditorView, typeName: string, occurrence = 0): number {
  let seen = 0;
  let found: number | null = null;
  view.state.doc.forEach((node, offset) => {
    if (found !== null || node.type.name !== typeName) return;
    if (seen === occurrence) {
      found = offset;
      return;
    }
    seen += 1;
  });

  if (found === null) {
    throw new Error(`Expected top-level ${typeName}`);
  }
  return found;
}

function textPosition(view: EditorView, text: string, offset = 0): number {
  let found: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found !== null || !node.isTextblock || node.textContent !== text) {
      return true;
    }

    found = pos + 1 + offset;
    return false;
  });

  if (found === null) {
    throw new Error(`Expected textblock "${text}"`);
  }

  return found;
}

function pressKey(view: EditorView, key: string, options?: { shiftKey?: boolean }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    shiftKey: options?.shiftKey,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) return handled;
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  return event;
}

function createAtomicNode(view: EditorView, typeName: 'math_block' | 'mermaid'): ProseNode {
  const { schema } = view.state;
  return typeName === 'math_block'
    ? schema.nodes.math_block.create({ latex: 'x' })
    : schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' });
}

function createTableNode(view: EditorView): ProseNode {
  const table = createTableNodeFromPipeCells(view.state.schema, ['A', 'B']);
  if (!table) {
    throw new Error('Expected table schema');
  }
  return table;
}

function createCodeBlockNode(view: EditorView, text = 'const value = 1;'): ProseNode {
  const { schema } = view.state;
  const codeBlockType = schema.nodes.code_block;
  if (!codeBlockType) {
    throw new Error('Expected code block schema');
  }
  return codeBlockType.create({ language: 'ts' }, text ? schema.text(text) : undefined);
}

function createMarkdownBlankLinePlaceholderNode(view: EditorView): ProseNode {
  const htmlBlockType = view.state.schema.nodes.html_block;
  if (!htmlBlockType) {
    throw new Error('Expected html block schema');
  }
  return htmlBlockType.create({ value: '<!--vlaina-markdown-blank-line-->' });
}

function createTaskListNode(view: EditorView, text = '1'): ProseNode {
  const { schema } = view.state;
  return schema.nodes.bullet_list.create(null, [
    schema.nodes.list_item.create({ checked: false }, [
      schema.nodes.paragraph.create(null, schema.text(text)),
    ]),
  ]);
}

function createBulletListNode(view: EditorView, text = '1'): ProseNode {
  const { schema } = view.state;
  return schema.nodes.bullet_list.create(null, [
    schema.nodes.list_item.create(null, [
      schema.nodes.paragraph.create(null, schema.text(text)),
    ]),
  ]);
}

function createOrderedListNode(view: EditorView, text = '1'): ProseNode {
  const { schema } = view.state;
  return schema.nodes.ordered_list.create(null, [
    schema.nodes.list_item.create(null, [
      schema.nodes.paragraph.create(null, schema.text(text)),
    ]),
  ]);
}

function createNestedBlockquoteNode(view: EditorView): ProseNode {
  const { schema } = view.state;
  return schema.nodes.blockquote.create(null, [
    schema.nodes.paragraph.create(null, schema.text('h')),
    schema.nodes.blockquote.create(null, [
      schema.nodes.paragraph.create(null, schema.text('i')),
    ]),
  ]);
}

function createNestedBlockquoteSandwichNode(view: EditorView): ProseNode {
  const { schema } = view.state;
  return schema.nodes.blockquote.create(null, [
    schema.nodes.paragraph.create(null, schema.text('11')),
    schema.nodes.blockquote.create(null, [
      schema.nodes.paragraph.create(null, schema.text('22')),
    ]),
    schema.nodes.paragraph.create(null, schema.text('33')),
  ]);
}

function createTextContainerWithNestedBlockquoteSandwichNode(
  view: EditorView,
  typeName: 'callout' | 'footnote_def'
): ProseNode {
  const { schema } = view.state;
  const content = [
    schema.nodes.paragraph.create(null, schema.text('11')),
    schema.nodes.blockquote.create(null, [
      schema.nodes.paragraph.create(null, schema.text('22')),
    ]),
    schema.nodes.paragraph.create(null, schema.text('33')),
  ];

  return typeName === 'callout'
    ? schema.nodes.callout.create(null, content)
    : schema.nodes.footnote_def.create({ id: 'nested-boundary' }, content);
}

function createStructuralBlockCases(view: EditorView): Array<{
  label: string;
  typeName: string;
  node: ProseNode;
}> {
  const { schema } = view.state;
  return [
    {
      label: 'heading',
      typeName: 'heading',
      node: schema.nodes.heading.create({ level: 2 }, schema.text('Heading')),
    },
    {
      label: 'blockquote',
      typeName: 'blockquote',
      node: schema.nodes.blockquote.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Quote')),
      ]),
    },
    {
      label: 'callout',
      typeName: 'callout',
      node: schema.nodes.callout.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Callout')),
      ]),
    },
    {
      label: 'frontmatter',
      typeName: 'frontmatter',
      node: schema.nodes.frontmatter.create(null, schema.text('title: Demo')),
    },
    {
      label: 'footnote_def',
      typeName: 'footnote_def',
      node: schema.nodes.footnote_def.create({ id: '1' }, [
        schema.nodes.paragraph.create(null, schema.text('Footnote')),
      ]),
    },
    {
      label: 'html_block',
      typeName: 'html_block',
      node: schema.nodes.html_block.create({ value: '<div>HTML</div>' }),
    },
    {
      label: 'code_block',
      typeName: 'code_block',
      node: createCodeBlockNode(view),
    },
    {
      label: 'table',
      typeName: 'table',
      node: createTableNode(view),
    },
    {
      label: 'toc',
      typeName: 'toc',
      node: schema.nodes.toc.create({ maxLevel: 6 }),
    },
    {
      label: 'video',
      typeName: 'video',
      node: schema.nodes.video.create({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    },
    {
      label: 'math_block',
      typeName: 'math_block',
      node: createAtomicNode(view, 'math_block'),
    },
    {
      label: 'mermaid',
      typeName: 'mermaid',
      node: createAtomicNode(view, 'mermaid'),
    },
    {
      label: 'bullet_list',
      typeName: 'bullet_list',
      node: createBulletListNode(view),
    },
    {
      label: 'task_list',
      typeName: 'bullet_list',
      node: createTaskListNode(view),
    },
    {
      label: 'ordered_list',
      typeName: 'ordered_list',
      node: createOrderedListNode(view),
    },
  ];
}

function replaceWithOrderedListGapAndTaskList(view: EditorView): void {
  const { schema } = view.state;
  replaceDocument(view, [
    schema.nodes.ordered_list.create(null, [
      schema.nodes.list_item.create(null, [
        schema.nodes.paragraph.create(null, schema.text('1')),
      ]),
    ]),
    schema.nodes.paragraph.create(),
    createTaskListNode(view),
  ]);
}

function replaceWithOrderedListGapAndOrderedList(view: EditorView): void {
  const { schema } = view.state;
  replaceDocument(view, [
    schema.nodes.ordered_list.create(null, [
      schema.nodes.list_item.create(null, [
        schema.nodes.paragraph.create(null, schema.text('one')),
      ]),
    ]),
    schema.nodes.paragraph.create(),
    schema.nodes.ordered_list.create(null, [
      schema.nodes.list_item.create(null, [
        schema.nodes.paragraph.create(null, schema.text('two')),
      ]),
    ]),
  ]);
}

function selectionAncestorNames(view: EditorView): string[] {
  const { $from } = view.state.selection;
  const names: string[] = [];
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
}

function expectCursorAtHeadingEdge(view: EditorView, headingPos: number, edge: 'start' | 'end'): void {
  const heading = view.state.doc.nodeAt(headingPos);
  expect(heading?.type.name).toBe('heading');
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  expect(view.state.selection.empty).toBe(true);
  expect(view.state.selection.from).toBe(
    edge === 'start'
      ? headingPos + 1
      : headingPos + 1 + (heading?.content.size ?? 0)
  );
}

function expectCursorAtBlockquoteEdge(view: EditorView, blockquotePos: number, edge: 'start' | 'end'): void {
  const blockquote = view.state.doc.nodeAt(blockquotePos);
  const firstParagraph = blockquote?.firstChild;
  expect(blockquote?.type.name).toBe('blockquote');
  expect(firstParagraph?.type.name).toBe('paragraph');
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
  expect(view.state.selection.empty).toBe(true);
  expect(view.state.selection.from).toBe(
    edge === 'start'
      ? blockquotePos + 2
      : blockquotePos + 2 + (firstParagraph?.content.size ?? 0)
  );
}

function expectCursorInsideFirstTextblockOfContainer(view: EditorView, containerPos: number, edge: 'start' | 'end'): void {
  const container = view.state.doc.nodeAt(containerPos);
  const firstTextblock = container?.firstChild;
  expect(container).toBeTruthy();
  expect(firstTextblock?.isTextblock).toBe(true);
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
  expect(view.state.selection.empty).toBe(true);
  expect(view.state.selection.$from.parent).toBe(firstTextblock);
  expect(view.state.selection.from).toBe(
    edge === 'start'
      ? containerPos + 2
      : containerPos + 2 + (firstTextblock?.content.size ?? 0)
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('atomicBlockKeyboardNavigationPlugin', () => {
  it('moves past a diagram block when ArrowDown leaves the preceding paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph.create(null, schema.text('before'));
    const mermaid = schema.nodes.mermaid.create({ code: 'flowchart TD\nA --> B' });
    replaceDocument(view, [paragraph, mermaid]);

    const paragraphEnd = 1 + paragraph.content.size;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphEnd)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(2));
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(false);

    await editor.destroy();
  });

  it('clears the keyboard-selected caret suppression when selection returns to text', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(false);

    await editor.destroy();
  });

  it('moves past a formula block when ArrowUp leaves the following paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const math = schema.nodes.math_block.create({ latex: 'x' });
    const paragraph = schema.nodes.paragraph.create(null, schema.text('after'));
    replaceDocument(view, [math, paragraph]);

    const paragraphStart = topLevelNodePos(view, 'paragraph') + 1;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphStart)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).type.name).toBe('math_block');
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(0));
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(false);

    await editor.destroy();
  });

  it('converts an html markdown blank-line placeholder instead of treating it as an atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const htmlBlock = schema.nodes.html_block.create({ value: '<p>HTML</p>' });
    const after = schema.nodes.paragraph.create(null, schema.text('after'));
    replaceDocument(view, [
      htmlBlock,
      createMarkdownBlankLinePlaceholderNode(view),
      after,
    ]);

    const afterPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, afterPos + 1)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('html_block');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
    expect(view.state.doc.child(2).textContent).toBe('after');
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));

    await editor.destroy();
  });

  it('moves to the nested blockquote line end when ArrowUp enters it from the paragraph below', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const after = schema.nodes.paragraph.create();
    replaceDocument(view, [
      createNestedBlockquoteNode(view),
      after,
    ]);

    const afterPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, afterPos + 1)));

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('i');
    expect(view.state.selection.$from.parentOffset).toBe('i'.length);

    await editor.destroy();
  });

  it('moves to the first blockquote line start when ArrowDown enters it from the paragraph above', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const before = schema.nodes.paragraph.create();
    replaceDocument(view, [
      before,
      createNestedBlockquoteNode(view),
    ]);

    const beforePos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, beforePos + 1)));

    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('h');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it.each<[string, number]>([
    ['start', 0],
    ['middle', 1],
  ])('moves from the %s of a following quote paragraph to the nested quote line end on ArrowUp', async (_label, offset) => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createNestedBlockquoteSandwichNode(view),
    ]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, '33', offset))));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('22');
    expect(view.state.selection.$from.parentOffset).toBe('22'.length);

    await editor.destroy();
  });

  it('moves from the first quote paragraph to the nested quote line end on ArrowDown', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createNestedBlockquoteSandwichNode(view),
    ]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, '11', 1))));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('22');
    expect(view.state.selection.$from.parentOffset).toBe('22'.length);

    await editor.destroy();
  });

  it('moves from the nested quote line to adjacent outer quote paragraphs at vertical boundaries', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    replaceDocument(view, [
      createNestedBlockquoteSandwichNode(view),
    ]);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, '22', 0))));

    let boundarySpy = vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    let event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.textContent).toBe('11');
    expect(view.state.selection.$from.parentOffset).toBe('11'.length);

    boundarySpy.mockRestore();
    replaceDocument(view, [
      createNestedBlockquoteSandwichNode(view),
    ]);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, '22', '22'.length))));

    boundarySpy = vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.textContent).toBe('33');
    expect(view.state.selection.$from.parentOffset).toBe('33'.length);

    await editor.destroy();
  });

  it('does not override native vertical movement between same-depth quote paragraphs', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.blockquote.create(null, [
        schema.nodes.paragraph.create(null, schema.text('aa')),
        schema.nodes.paragraph.create(null, schema.text('bb')),
      ]),
    ]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, 'bb', 1))));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.textContent).toBe('bb');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it.each<['callout' | 'footnote_def']>([
    ['callout'],
    ['footnote_def'],
  ])('moves across nested blockquote boundaries inside %s at line ends', async (typeName) => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const resetSelection = (text: string, offset: number) => {
      replaceDocument(view, [
        createTextContainerWithNestedBlockquoteSandwichNode(view, typeName),
      ]);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textPosition(view, text, offset))));
    };

    resetSelection('11', 1);
    let event = pressKey(view, 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('22');
    expect(view.state.selection.$from.parentOffset).toBe('22'.length);

    resetSelection('33', 0);
    event = pressKey(view, 'ArrowUp');
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('22');
    expect(view.state.selection.$from.parentOffset).toBe('22'.length);

    resetSelection('22', 0);
    event = pressKey(view, 'ArrowUp');
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('11');
    expect(view.state.selection.$from.parentOffset).toBe('11'.length);

    resetSelection('22', '22'.length);
    event = pressKey(view, 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('33');
    expect(view.state.selection.$from.parentOffset).toBe('33'.length);

    await editor.destroy();
  });

  it('does not create a new blank line below an html block when ArrowUp crosses it', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const before = schema.nodes.paragraph.create(null, schema.text('before'));
    const htmlBlock = schema.nodes.html_block.create({ value: '<p>HTML</p>' });
    const after = schema.nodes.paragraph.create(null, schema.text('after'));
    replaceDocument(view, [
      before,
      createMarkdownBlankLinePlaceholderNode(view),
      htmlBlock,
      after,
    ]);

    const afterPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, afterPos + 1)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(4);
    expect(view.state.doc.child(0).textContent).toBe('before');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
    expect(view.state.doc.child(2).type.name).toBe('html_block');
    expect(view.state.doc.child(2).attrs.value).toBe('<p>HTML</p>');
    expect(view.state.doc.child(3).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));

    await editor.destroy();
  });

  it('converts rendered html boundary blank lines before crossing an html block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      schema.nodes.html_block.create({ value: RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE }),
      schema.nodes.html_block.create({ value: '<div>HTML</div>' }),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const afterPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, afterPos + 1)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(4);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER);
    expect(view.state.doc.child(2).type.name).toBe('html_block');
    expect(view.state.doc.child(2).attrs.value).toBe('<div>HTML</div>');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));

    await editor.destroy();
  });

  it.each(['Backspace', 'Delete'] as const)(
    'deletes an empty paragraph next to markdown blank-line placeholders on %s without selecting a blank-line block',
    async (key) => {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const { schema } = view.state;
      replaceDocument(view, [
        schema.nodes.paragraph.create(null, schema.text('before')),
        createMarkdownBlankLinePlaceholderNode(view),
        schema.nodes.paragraph.create(),
        createMarkdownBlankLinePlaceholderNode(view),
        schema.nodes.paragraph.create(null, schema.text('after')),
      ]);

      const emptyParagraphPos = topLevelNodePos(view, 'paragraph', 1);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));

      const event = pressKey(view, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.empty).toBe(true);
      expect(view.state.doc.childCount).toBe(4);
      expect(view.state.doc.child(0).textContent).toBe('before');
      expect(view.state.doc.child(3).textContent).toBe('after');

      const convertedBlankLineIndex = key === 'Backspace' ? 1 : 2;
      expect(view.state.doc.child(convertedBlankLineIndex).type.name).toBe('paragraph');
      expect(view.state.doc.child(convertedBlankLineIndex).textContent).toBe(
        EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
      );
      expect(view.state.selection.$from.parent).toBe(view.state.doc.child(convertedBlankLineIndex));

      await editor.destroy();
    }
  );

  it('moves past navigable atom-like blocks without exposing native node selection', async () => {
    const cases: Array<{
      label: string;
      createNode: (view: EditorView) => ProseNode;
    }> = [
      {
        label: 'math_block',
        createNode: (view) => view.state.schema.nodes.math_block.create({ latex: 'x' }),
      },
      {
        label: 'mermaid',
        createNode: (view) => view.state.schema.nodes.mermaid.create({ code: 'flowchart TD\nA --> B' }),
      },
      {
        label: 'video',
        createNode: (view) => view.state.schema.nodes.video.create({ src: 'https://example.com/video.mp4' }),
      },
      {
        label: 'html_block',
        createNode: (view) => view.state.schema.nodes.html_block.create({ value: '<div>HTML</div>' }),
      },
    ];

    for (const testCase of cases) {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const { schema } = view.state;
      const before = schema.nodes.paragraph.create(null, schema.text('before'));
      const after = schema.nodes.paragraph.create(null, schema.text('after'));
      replaceDocument(view, [before, testCase.createNode(view), after]);
      vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1 + before.content.size)));
      const downEvent = pressKey(view, 'ArrowDown');
      expect(downEvent.defaultPrevented, `${testCase.label} ArrowDown`).toBe(true);
      expect(view.state.doc.childCount, testCase.label).toBe(3);
      expect(view.state.selection, `${testCase.label} ArrowDown`).toBeInstanceOf(TextSelection);
      expect(view.state.selection, `${testCase.label} ArrowDown`).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.$from.parent, `${testCase.label} ArrowDown`).toBe(view.state.doc.child(2));

      const afterPos = topLevelNodePos(view, 'paragraph', 1);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, afterPos + 1)));
      const upEvent = pressKey(view, 'ArrowUp');
      expect(upEvent.defaultPrevented, `${testCase.label} ArrowUp`).toBe(true);
      expect(view.state.doc.childCount, testCase.label).toBe(3);
      expect(view.state.selection, `${testCase.label} ArrowUp`).toBeInstanceOf(TextSelection);
      expect(view.state.selection, `${testCase.label} ArrowUp`).not.toBeInstanceOf(NodeSelection);
      expect(view.state.selection.$from.parent, `${testCase.label} ArrowUp`).toBe(view.state.doc.child(0));

      await editor.destroy();
    }
  });

  it('moves from a selected atomic block into the following paragraph without inserting a transient one', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);
    expect(view.state.doc.child(1).textContent).toBe('after');

    await editor.destroy();
  });

  it('inserts a transient empty paragraph between adjacent math and diagram blocks', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const math = schema.nodes.math_block.create({ latex: 'x' });
    const mermaid = schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' });
    replaceDocument(view, [math, mermaid]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).content.size).toBe(0);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    await editor.destroy();
  });

  it('inserts a transient paragraph for every adjacent formula and diagram pairing', async () => {
    const pairs: Array<['math_block' | 'mermaid', 'math_block' | 'mermaid']> = [
      ['math_block', 'math_block'],
      ['mermaid', 'mermaid'],
      ['math_block', 'mermaid'],
      ['mermaid', 'math_block'],
    ];

    for (const [firstType, secondType] of pairs) {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      replaceDocument(view, [
        createAtomicNode(view, firstType),
        createAtomicNode(view, secondType),
      ]);

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
      const event = pressKey(view, 'ArrowDown');

      expect(event.defaultPrevented, `${firstType} -> ${secondType}`).toBe(true);
      expect(view.state.doc.childCount, `${firstType} -> ${secondType}`).toBe(3);
      expect(view.state.doc.child(1).type.name, `${firstType} -> ${secondType}`).toBe('paragraph');
      expect(view.state.selection).toBeInstanceOf(TextSelection);

      await editor.destroy();
    }
  });

  it('moves past the next atomic block when ArrowDown continues from a transient paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(2));

    await editor.destroy();
  });

  it('supports ArrowUp through adjacent atomic blocks with the same transient paragraph cleanup', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 1)));
    const insertEvent = pressKey(view, 'ArrowUp');

    expect(insertEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    const continueEvent = pressKey(view, 'ArrowUp');

    expect(continueEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).type.name).toBe('math_block');
    expect(view.state.doc.child(2).type.name).toBe('mermaid');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(0));

    await editor.destroy();
  });

  it('keeps the inserted paragraph once the user types into it', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.insertText('note'));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    const pastMermaid = pressKey(view, 'ArrowDown');

    expect(pastMermaid.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(4);
    expect(view.state.doc.child(1).textContent).toBe('note');
    expect(view.state.doc.child(2).type.name).toBe('mermaid');
    expect(view.state.doc.child(3).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(3));

    await editor.destroy();
  });

  it('keeps typed transient content when selection later moves elsewhere', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.insertText('note'));
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('note');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);

    await editor.destroy();
  });

  it('treats an existing empty paragraph between atomic blocks as a real editable paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const intoParagraph = pressKey(view, 'ArrowDown');
    const intoMermaid = pressKey(view, 'ArrowDown');

    expect(intoParagraph.defaultPrevented).toBe(true);
    expect(intoMermaid.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(4);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(2).type.name).toBe('mermaid');
    expect(view.state.doc.child(3).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(3));

    await editor.destroy();
  });

  it('creates a transient input paragraph below the last atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    const backEvent = pressKey(view, 'ArrowUp');

    expect(backEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(0));

    await editor.destroy();
  });

  it('creates a transient input paragraph above the first atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(1);

    const downEvent = pressKey(view, 'ArrowDown');

    expect(downEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(1));

    await editor.destroy();
  });

  it('moves from an atomic block into adjacent text without letting Enter delete the atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('above')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));
    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(6);

    expect(baseKeymap.Enter(view.state, view.dispatch, view)).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).textContent).toBe('above');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(2).type.name).toBe('mermaid');

    await editor.destroy();
  });

  it('does not intercept Shift+Arrow text selection behavior', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowDown', { shiftKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(6);
    expect(view.state.doc.childCount).toBe(2);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a table without moving to the next line first', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createTableNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('table');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(selectionAncestorNames(view)).toContain('table');

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a formula with the same structural block logic', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a diagram and selects that diagram', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'mermaid'),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('mermaid');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a code block without moving the cursor into code', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it.each(['Backspace', 'Delete'] as const)(
    'deletes an empty paragraph immediately below a blockquote on %s and places the cursor at the quote end',
    async (key) => {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const { schema } = view.state;
      replaceDocument(view, [
        schema.nodes.blockquote.create(null, [
          schema.nodes.paragraph.create(null, schema.text('Quote')),
        ]),
        schema.nodes.paragraph.create(),
        schema.nodes.paragraph.create(null, schema.text('after')),
      ]);

      const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
      const event = pressKey(view, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.doc.childCount).toBe(2);
      expect(view.state.doc.child(0).type.name).toBe('blockquote');
      expect(view.state.doc.child(1).textContent).toBe('after');
      expectCursorAtBlockquoteEdge(view, 0, 'end');

      await editor.destroy();
    }
  );

  it.each([
    {
      name: 'callout',
      typeName: 'callout',
      node: (view: EditorView) => view.state.schema.nodes.callout.create(null, [
        view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Callout')),
      ]),
    },
    {
      name: 'footnote definition',
      typeName: 'footnote_def',
      node: (view: EditorView) => view.state.schema.nodes.footnote_def.create({ id: '1' }, [
        view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Footnote')),
      ]),
    },
  ])('deletes an empty paragraph below a $name and places the cursor inside its content', async (testCase) => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      testCase.node(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe(testCase.typeName);
    expect(view.state.doc.child(1).textContent).toBe('after');
    expectCursorInsideFirstTextblockOfContainer(view, 0, 'end');

    await editor.destroy();
  });

  it('does not join the following paragraph into a code block on Backspace at its start', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const paragraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(0).textContent).toBe('const value = 1;');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('backspaces an empty paragraph immediately below a code block without moving the cursor into code', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('deletes an empty code block on Delete before structural navigation can select the previous block', async () => {
    const editor = createEditorWithCodeKeymap();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('above')),
      createCodeBlockNode(view, ''),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const codeBlockPos = topLevelNodePos(view, 'code_block');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeBlockPos + 1)));
    expect(selectionAncestorNames(view)).toContain('code_block');
    expect(view.state.selection.$from.parent.type.name).toBe('code_block');
    pressKey(view, 'Delete');

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('above');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);

    await editor.destroy();
  });

  it('deletes an empty code block through structural fallback when the code keymap is unavailable', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('above')),
      createCodeBlockNode(view, ''),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const codeBlockPos = topLevelNodePos(view, 'code_block');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeBlockPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('above');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);

    await editor.destroy();
  });

  it.each(['Backspace', 'Delete'] as const)(
    'deletes an empty paragraph below a heading on %s and places the cursor after the heading text',
    async (key) => {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const { schema } = view.state;
      const heading = schema.nodes.heading.create({ level: 2 }, schema.text('Heading'));
      replaceDocument(view, [
        heading,
        schema.nodes.paragraph.create(),
        schema.nodes.paragraph.create(null, schema.text('after')),
      ]);

      const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
      const event = pressKey(view, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.doc.childCount).toBe(2);
      expect(view.state.doc.child(0).type.name).toBe('heading');
      expect(view.state.doc.child(1).textContent).toBe('after');
      expectCursorAtHeadingEdge(view, 0, 'end');

      await editor.destroy();
    }
  );

  it.each(['Backspace', 'Delete'] as const)(
    'deletes an empty paragraph above a heading on %s and places the cursor before the heading text',
    async (key) => {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const { schema } = view.state;
      replaceDocument(view, [
        schema.nodes.paragraph.create(null, schema.text('before')),
        schema.nodes.paragraph.create(),
        schema.nodes.heading.create({ level: 2 }, schema.text('Heading')),
      ]);

      const emptyParagraphPos = topLevelNodePos(view, 'paragraph', 1);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
      const event = pressKey(view, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.doc.childCount).toBe(2);
      expect(view.state.doc.child(0).textContent).toBe('before');
      expect(view.state.doc.child(1).type.name).toBe('heading');
      expectCursorAtHeadingEdge(view, topLevelNodePos(view, 'heading'), 'start');

      await editor.destroy();
    }
  );

  it('keeps the cursor on the heading when deleting the empty paragraph between a heading and any supported structural block', async () => {
    const keys: Array<'Backspace' | 'Delete'> = ['Backspace', 'Delete'];
    const headingLayouts: Array<{
      name: string;
      edge: 'start' | 'end';
      buildNodes: (heading: ProseNode, emptyParagraph: ProseNode, otherBlock: ProseNode) => ProseNode[];
    }> = [
      {
        name: 'heading above',
        edge: 'end',
        buildNodes: (heading, emptyParagraph, otherBlock) => [heading, emptyParagraph, otherBlock],
      },
      {
        name: 'heading below',
        edge: 'start',
        buildNodes: (heading, emptyParagraph, otherBlock) => [otherBlock, emptyParagraph, heading],
      },
    ];

    const caseLabelsEditor = createEditor();
    await caseLabelsEditor.create();
    const caseLabelsView = caseLabelsEditor.ctx.get(editorViewCtx);
    const caseLabels = createStructuralBlockCases(caseLabelsView)
      .map(({ label }) => label)
      .filter((label) => label !== 'heading');
    await caseLabelsEditor.destroy();

    for (const key of keys) {
      for (const layout of headingLayouts) {
        for (const otherLabel of caseLabels) {
          const editor = createEditor();
          await editor.create();
          const view = editor.ctx.get(editorViewCtx);
          const { schema } = view.state;
          const other = createStructuralBlockCases(view).find((testCase) => testCase.label === otherLabel);
          if (!other) {
            throw new Error(`Missing structural block test case: ${otherLabel}`);
          }

          replaceDocument(view, layout.buildNodes(
            schema.nodes.heading.create({ level: 2 }, schema.text('Heading')),
            schema.nodes.paragraph.create(),
            other.node,
          ));

          const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
          const event = pressKey(view, key);

          const label = `${layout.name} with ${other.label} on ${key}`;
          expect(event.defaultPrevented, label).toBe(true);
          expect(view.state.doc.childCount, label).toBe(2);
          expectCursorAtHeadingEdge(view, topLevelNodePos(view, 'heading'), layout.edge);

          await editor.destroy();
        }
      }
    }
  }, 60_000);

  it('deletes the only empty paragraph below a code block and keeps an outside cursor target', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately above a diagram with the same structural block logic', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      schema.nodes.paragraph.create(),
      createAtomicNode(view, 'mermaid'),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('before');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'mermaid'));

    await editor.destroy();
  });

  it('backspaces an empty paragraph above a list back to the previous paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const before = schema.nodes.paragraph.create(null, schema.text('before'));
    replaceDocument(view, [
      before,
      schema.nodes.paragraph.create(),
      createBulletListNode(view, 'list item'),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('before');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('list_item');
    expect(view.state.selection.from).toBe(1 + before.content.size);

    await editor.destroy();
  });

  it('deletes an empty paragraph below a list forward to the next paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createBulletListNode(view, 'list item'),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    const afterParagraphPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('bullet_list');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('list_item');
    expect(view.state.selection.from).toBe(afterParagraphPos - 2 + 1);

    await editor.destroy();
  });

  it('deletes an empty paragraph between ordered and task lists on Delete', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndTaskList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).textContent).toBe('1');
    expect(view.state.doc.child(1).textContent).toBe('1');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('merges ordered lists when deleting the empty paragraph between them on Delete', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndOrderedList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(list.child(0).textContent).toBe('one');
    expect(list.child(1).textContent).toBe('two');
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('deletes an empty paragraph between ordered and task lists on Backspace', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndTaskList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).textContent).toBe('1');
    expect(view.state.doc.child(1).textContent).toBe('1');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('merges ordered lists when deleting the empty paragraph between them on Backspace', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndOrderedList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(list.child(0).textContent).toBe('one');
    expect(list.child(1).textContent).toBe('two');
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('deletes an empty paragraph between a horizontal rule and task list without moving into the task', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.hr.create(),
      schema.nodes.paragraph.create(),
      createTaskListNode(view),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('hr');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'hr'));
    expect(selectionAncestorNames(view)).not.toContain('list_item');

    await editor.destroy();
  });

  it('uses the non-list markdown block as the deletion anchor across representative block syntaxes, list types, and directions', async () => {
    const cases: Array<{
      name: string;
      node: (view: EditorView) => ProseNode;
      expectedNodeSelection?: boolean;
    }> = [
      {
        name: 'heading',
        node: (view) => view.state.schema.nodes.heading.create({ level: 2 }, view.state.schema.text('Heading')),
      },
      {
        name: 'blockquote',
        node: (view) => view.state.schema.nodes.blockquote.create(null, [
          view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Quote')),
        ]),
      },
      {
        name: 'callout',
        node: (view) => view.state.schema.nodes.callout.create(null, [
          view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Callout')),
        ]),
      },
      {
        name: 'frontmatter',
        node: (view) => view.state.schema.nodes.frontmatter.create(null, view.state.schema.text('title: Demo')),
        expectedNodeSelection: true,
      },
      {
        name: 'footnote_def',
        node: (view) => view.state.schema.nodes.footnote_def.create({ id: '1' }, [
          view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Footnote')),
        ]),
      },
      {
        name: 'html_block',
        node: (view) => view.state.schema.nodes.html_block.create({ value: '<div>HTML</div>' }),
        expectedNodeSelection: true,
      },
      {
        name: 'code_block',
        node: (view) => createCodeBlockNode(view),
        expectedNodeSelection: true,
      },
      {
        name: 'table',
        node: (view) => createTableNode(view),
      },
      {
        name: 'toc',
        node: (view) => view.state.schema.nodes.toc.create({ maxLevel: 6 }),
        expectedNodeSelection: true,
      },
      {
        name: 'video',
        node: (view) => view.state.schema.nodes.video.create({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
        expectedNodeSelection: true,
      },
      {
        name: 'math_block',
        node: (view) => createAtomicNode(view, 'math_block'),
        expectedNodeSelection: true,
      },
      {
        name: 'mermaid',
        node: (view) => createAtomicNode(view, 'mermaid'),
        expectedNodeSelection: true,
      },
    ];
    const layouts: Array<{
      name: string;
      key: 'Backspace' | 'Delete';
      markdownBlockPosition: 'above' | 'below';
      buildNodes: (view: EditorView, markdownBlock: ProseNode, emptyParagraph: ProseNode, list: ProseNode) => ProseNode[];
    }> = [
      {
        name: 'block above, Delete',
        key: 'Delete',
        markdownBlockPosition: 'above',
        buildNodes: (_view, markdownBlock, emptyParagraph, taskList) => [markdownBlock, emptyParagraph, taskList],
      },
      {
        name: 'block above, Backspace',
        key: 'Backspace',
        markdownBlockPosition: 'above',
        buildNodes: (_view, markdownBlock, emptyParagraph, taskList) => [markdownBlock, emptyParagraph, taskList],
      },
      {
        name: 'block below, Delete',
        key: 'Delete',
        markdownBlockPosition: 'below',
        buildNodes: (_view, markdownBlock, emptyParagraph, taskList) => [taskList, emptyParagraph, markdownBlock],
      },
      {
        name: 'block below, Backspace',
        key: 'Backspace',
        markdownBlockPosition: 'below',
        buildNodes: (_view, markdownBlock, emptyParagraph, taskList) => [taskList, emptyParagraph, markdownBlock],
      },
    ];
    const listCases: Array<{
      name: string;
      node: (view: EditorView) => ProseNode;
      typeName: string;
    }> = [
      {
        name: 'bullet list',
        node: (view) => createBulletListNode(view),
        typeName: 'bullet_list',
      },
      {
        name: 'task list',
        node: (view) => createTaskListNode(view),
        typeName: 'bullet_list',
      },
      {
        name: 'ordered list',
        node: (view) => createOrderedListNode(view),
        typeName: 'ordered_list',
      },
    ];

    for (const testCase of cases) {
      for (const listCase of listCases) {
        for (const layout of layouts) {
          const editor = createEditor();
          await editor.create();
          const view = editor.ctx.get(editorViewCtx);
          const { schema } = view.state;
          const markdownBlock = testCase.node(view);
          replaceDocument(view, layout.buildNodes(
            view,
            markdownBlock,
            schema.nodes.paragraph.create(),
            listCase.node(view),
          ));

          const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
          const event = pressKey(view, layout.key);

          const label = `${testCase.name}, ${listCase.name}, ${layout.name}`;
          const remainingNodeNames = Array.from({ length: view.state.doc.childCount }, (_, index) =>
            view.state.doc.child(index).type.name
          );
          expect(event.defaultPrevented, label).toBe(true);
          expect(remainingNodeNames, label).toHaveLength(2);
          expect(remainingNodeNames, label).toContain(testCase.name);
          expect(remainingNodeNames, label).toContain(listCase.typeName);
          expect(selectionAncestorNames(view), label).not.toContain('list_item');
          if (testCase.name === 'heading') {
            const headingPos = topLevelNodePos(view, 'heading');
            expectCursorAtHeadingEdge(
              view,
              headingPos,
              layout.markdownBlockPosition === 'above' ? 'end' : 'start'
            );
          }
          if (testCase.name === 'blockquote') {
            const blockquotePos = topLevelNodePos(view, 'blockquote');
            expectCursorAtBlockquoteEdge(
              view,
              blockquotePos,
              layout.markdownBlockPosition === 'above' ? 'end' : 'start'
            );
          }
          if (testCase.name === 'callout' || testCase.name === 'footnote_def') {
            const containerPos = topLevelNodePos(view, testCase.name);
            expectCursorInsideFirstTextblockOfContainer(
              view,
              containerPos,
              layout.markdownBlockPosition === 'above' ? 'end' : 'start'
            );
          }
          if (testCase.expectedNodeSelection) {
            expect(view.state.selection, label).toBeInstanceOf(NodeSelection);
          }

          await editor.destroy();
        }
      }
    }
  }, 30000);

  it('deletes the empty paragraph between every supported structural block pair', async () => {
    const keys: Array<'Backspace' | 'Delete'> = ['Backspace', 'Delete'];

    for (const key of keys) {
      const caseLabelsEditor = createEditor();
      await caseLabelsEditor.create();
      const caseLabelsView = caseLabelsEditor.ctx.get(editorViewCtx);
      const caseLabels = createStructuralBlockCases(caseLabelsView).map(({ label }) => label);
      await caseLabelsEditor.destroy();

      for (const previousLabel of caseLabels) {
        for (const nextLabel of caseLabels) {
          const editor = createEditor();
          await editor.create();
          const view = editor.ctx.get(editorViewCtx);
          const { schema } = view.state;
          const previous = createStructuralBlockCases(view).find((testCase) => testCase.label === previousLabel);
          const next = createStructuralBlockCases(view).find((testCase) => testCase.label === nextLabel);
          if (!previous || !next) {
            throw new Error(`Missing structural block test case: ${previousLabel} -> ${nextLabel}`);
          }

          replaceDocument(view, [
            previous.node,
            schema.nodes.paragraph.create(),
            next.node,
          ]);

          const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
          const event = pressKey(view, key);

          const label = `${previous.label} -> ${next.label} on ${key}`;
          const remainingNodeNames = Array.from({ length: view.state.doc.childCount }, (_, index) =>
            view.state.doc.child(index).type.name
          );
          expect(event.defaultPrevented, label).toBe(true);
          if (previous.typeName === 'ordered_list' && next.typeName === 'ordered_list') {
            expect(remainingNodeNames, label).toEqual(['ordered_list']);
          } else {
            expect(remainingNodeNames, label).toHaveLength(2);
            expect(remainingNodeNames, label).toContain(previous.typeName);
            expect(remainingNodeNames, label).toContain(next.typeName);
          }

          await editor.destroy();
        }
      }
    }
  }, 90_000);

  it('removes the transient paragraph when selection moves elsewhere without input', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 3)));

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');

    await editor.destroy();
  });
});
