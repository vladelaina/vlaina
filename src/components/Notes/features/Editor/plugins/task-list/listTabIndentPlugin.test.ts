import '@testing-library/jest-dom/vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { Selection as ProseSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { describe, expect, it } from 'vitest';
import { listTabIndentPlugin } from './listTabIndentPlugin';

function createEditorWithContent(content: string) {
  const editor = Editor.make() as any;
  editor
    .config((ctx: any) => {
      ctx.set(defaultValueCtx, content);
      ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
        ...prev,
        bullet: '-',
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(listTabIndentPlugin);
  return editor;
}

function moveCursorToDocumentEnd(view: EditorView) {
  const selection = (ProseSelection as any).atEnd((view.state as any).doc);
  view.dispatch((view.state as any).tr.setSelection(selection));
}

function moveCursorAfterText(view: EditorView, text: string) {
  let pos: number | null = null;
  view.state.doc.descendants((node, nodePos) => {
    if (pos !== null || !node.isText || typeof node.text !== 'string') return;
    const index = node.text.indexOf(text);
    if (index < 0) return;
    pos = nodePos + index + text.length;
  });
  if (pos === null) {
    throw new Error(`Expected text: ${text}`);
  }
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

function moveCursorToFirstEmptyParagraph(view: EditorView) {
  let pos: number | null = null;
  view.state.doc.descendants((node, nodePos) => {
    if (pos !== null || node.type.name !== 'paragraph' || node.content.size !== 0) return false;
    pos = nodePos + 1;
    return false;
  });
  if (pos === null) {
    throw new Error('Expected empty paragraph');
  }
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

function typeText(view: EditorView, input: string) {
  for (const text of input) {
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: any) => {
      handled = handleTextInput(view, from, to, text) || handled;
    });

    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
  }
}

function selectionAncestorNames(view: EditorView): string[] {
  const names: string[] = [];
  const { $from } = view.state.selection;
  for (let depth = 0; depth <= $from.depth; depth += 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
}

function pressTab(view: EditorView, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...init,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  return { event, handled };
}

function pressEnter(view: EditorView) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  return { event, handled };
}

function replaceDocument(view: EditorView, nodes: any[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function getMarkdown(editor: any): string {
  return editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    const serializer = ctx.get(serializerCtx);
    return serializer(view.state.doc);
  });
}

describe('listTabIndentPlugin', () => {
  it('prevents focus from leaving the editor when tab has no editor action', async () => {
    const editor = createEditorWithContent('Plain paragraph');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents focus jumps when a list item cannot be indented further', async () => {
    const editor = createEditorWithContent('- first item');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves modified tab shortcuts to the app and browser', async () => {
    const editor = createEditorWithContent('Plain paragraph');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view, { ctrlKey: true });

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('treats an internal list gap placeholder item as empty when pressing enter', async () => {
    const editor = createEditorWithContent(['- first', '- \u2800'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressEnter(view);
    const markdown = getMarkdown(editor);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(markdown).toContain('- first');
    expect(markdown).not.toContain('\u2800');
    expect(markdown).not.toContain('- <br />');
  });

  it('marks internal list gap placeholder items for blank-line styling', async () => {
    const editor = createEditorWithContent(['- first', '- \u2800', '- second'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    expect(view.dom.querySelectorAll('li.vlaina-list-gap-placeholder-item')).toHaveLength(1);
  });

  it('renumbers ordered list items after deleting an internal gap item', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('one')),
        ]),
        schema.nodes.list_item.create({ label: '2.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('\u2800')),
        ]),
        schema.nodes.list_item.create({ label: '3.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('two')),
        ]),
      ]),
    ]);

    const list = view.state.doc.child(0);
    const gapFrom = 1 + list.child(0).nodeSize;
    view.dispatch(view.state.tr.delete(gapFrom, gapFrom + list.child(1).nodeSize));

    const updatedList = view.state.doc.child(0);
    expect(updatedList.childCount).toBe(2);
    expect(updatedList.child(0).attrs.label).toBe('1.');
    expect(updatedList.child(1).attrs.label).toBe('2.');
  });

  it('merges adjacent ordered lists after an editing transaction removes their separator', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('one')),
        ]),
      ]),
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('two')),
        ]),
      ]),
    ]);

    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');
  });

  it('merges adjacent nested ordered lists after an editing transaction removes their separator', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.bullet_list.create(null, [
        schema.nodes.list_item.create(null, [
          schema.nodes.paragraph.create(null, schema.text('parent')),
          schema.nodes.ordered_list.create(null, [
            schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
              schema.nodes.paragraph.create(null, schema.text('one')),
            ]),
          ]),
          schema.nodes.ordered_list.create(null, [
            schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
              schema.nodes.paragraph.create(null, schema.text('two')),
            ]),
          ]),
        ]),
      ]),
    ]);

    const parentItem = view.state.doc.child(0).child(0);
    expect(parentItem.childCount).toBe(2);
    const nestedList = parentItem.child(1);
    expect(nestedList.type.name).toBe('ordered_list');
    expect(nestedList.childCount).toBe(2);
    expect(nestedList.child(0).attrs.label).toBe('1.');
    expect(nestedList.child(1).attrs.label).toBe('2.');
  });

  it('keeps the cursor in a newly inserted middle ordered list item', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('1')),
        ]),
      ]),
      schema.nodes.paragraph.create(),
      schema.nodes.ordered_list.create({ order: 3 }, [
        schema.nodes.list_item.create({ label: '3.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('3')),
        ]),
      ]),
    ]);

    moveCursorToFirstEmptyParagraph(view);
    typeText(view, '2. ');

    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(3);
    expect(list.child(0).textContent).toBe('1');
    expect(list.child(1).textContent).toBe('');
    expect(list.child(2).textContent).toBe('3');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(selectionAncestorNames(view)).toContain('list_item');
    expect(view.state.selection.$from.node(-1).attrs.label).toBe('2.');
  });

  it('renumbers the following ordered list after typing an ordered marker into the gap', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('1')),
        ]),
      ]),
      schema.nodes.paragraph.create(),
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('2')),
        ]),
      ]),
    ]);

    moveCursorToFirstEmptyParagraph(view);
    typeText(view, '4. ');

    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(3);
    expect(list.child(0).textContent).toBe('1');
    expect(list.child(1).textContent).toBe('');
    expect(list.child(2).textContent).toBe('2');
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(list.child(2).attrs.label).toBe('3.');
  });

  it('turns a typed ordered-list gap placeholder into an ordered item', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('1')),
        ]),
      ]),
      schema.nodes.bullet_list.create(null, [
        schema.nodes.list_item.create({ label: '•', listType: 'bullet' }, [
          schema.nodes.paragraph.create(null, schema.text('\u2800')),
        ]),
      ]),
      schema.nodes.ordered_list.create({ order: 3 }, [
        schema.nodes.list_item.create({ label: '3.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('3')),
        ]),
      ]),
    ]);

    moveCursorAfterText(view, '\u2800');
    typeText(view, '2');

    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('2');

    typeText(view, '. ');

    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(view.state.doc.childCount).toBe(1);
    expect(list.childCount).toBe(3);
    expect(list.child(0).textContent).toBe('1');
    expect(list.child(1).textContent).toBe('');
    expect(list.child(2).textContent).toBe('3');
    expect(list.child(1).attrs.listType).toBe('ordered');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(view.state.selection.$from.node(-1).attrs.label).toBe('2.');
  });

  it('turns only the edited placeholder into a paragraph when an ordered-list gap has multiple blanks', async () => {
    const editor = createEditorWithContent('');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.ordered_list.create(null, [
        schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('1')),
        ]),
      ]),
      schema.nodes.bullet_list.create(null, [
        schema.nodes.list_item.create({ label: '•', listType: 'bullet' }, [
          schema.nodes.paragraph.create(null, schema.text('\u2800')),
        ]),
        schema.nodes.list_item.create({ label: '•', listType: 'bullet' }, [
          schema.nodes.paragraph.create(null, schema.text('\u2800')),
        ]),
      ]),
      schema.nodes.ordered_list.create({ order: 3 }, [
        schema.nodes.list_item.create({ label: '3.', listType: 'ordered' }, [
          schema.nodes.paragraph.create(null, schema.text('3')),
        ]),
      ]),
    ]);

    moveCursorAfterText(view, '\u2800');
    typeText(view, '2');

    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('2');
    expect(view.state.doc.child(2).type.name).toBe('bullet_list');
    expect(view.state.doc.child(2).childCount).toBe(1);
    expect(view.state.doc.child(2).textContent).toBe('\u2800');
    expect(view.state.doc.child(3).type.name).toBe('ordered_list');
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph');
  });

  it('renumbers ordered list items after splitting an item with Enter', async () => {
    const editor = createEditorWithContent(['1. one', '2. two'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorAfterText(view, 'one');

    const { event, handled } = pressEnter(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(3);
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');
    expect(list.child(2).attrs.label).toBe('3.');
    expect(list.child(0).textContent).toBe('one');
    expect(list.child(1).textContent).toBe('');
    expect(list.child(2).textContent).toBe('two');
  });

  it('keeps parent and nested ordered list labels stable after indenting with Tab', async () => {
    const editor = createEditorWithContent(['1. one', '2. two', '3. three'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorAfterText(view, 'two');

    const { event, handled } = pressTab(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).attrs.label).toBe('1.');
    expect(list.child(1).attrs.label).toBe('2.');

    const firstItem = list.child(0);
    const nestedList = firstItem.child(firstItem.childCount - 1);
    expect(nestedList.type.name).toBe('ordered_list');
    expect(nestedList.childCount).toBe(1);
    expect(nestedList.child(0).attrs.label).toBe('1.');
    expect(nestedList.child(0).textContent).toBe('two');
    expect(list.child(1).textContent).toBe('three');
  });

});
