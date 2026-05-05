import { describe, expect, it, vi } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { calloutPlugin } from '../callout';
import { containerBoundaryShiftSelectionPlugin } from './containerBoundaryShiftSelectionPlugin';

function createEditor() {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
    })
    .use(commonmark)
    .use(calloutPlugin)
    .use(containerBoundaryShiftSelectionPlugin);
}

function replaceDocument(view: EditorView, nodes: ProseNode[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function findTopLevelNodePos(view: EditorView, typeName: string, occurrence = 0): number {
  let matchIndex = 0;
  let foundPos: number | null = null;

  view.state.doc.forEach((node, offset) => {
    if (foundPos !== null || node.type.name !== typeName) return;
    if (matchIndex === occurrence) {
      foundPos = offset;
      return;
    }
    matchIndex += 1;
  });

  if (foundPos === null) {
    throw new Error(`Expected ${typeName} node`);
  }

  return foundPos;
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

describe('containerBoundaryShiftSelectionPlugin', () => {
  it('keeps the first Shift+ArrowUp within the paragraph below a callout, then lets the next one extend', async () => {
    const editor = createEditor();
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.callout.create(null, [
        schema.nodes.paragraph.create(null, schema.text('inside')),
      ]),
      schema.nodes.paragraph.create(null, schema.text('outside')),
    ]);

    const paragraphPos = findTopLevelNodePos(view, 'paragraph');
    const paragraph = view.state.doc.child(1);
    const paragraphStart = paragraphPos + 1;
    const paragraphEnd = paragraphStart + paragraph.content.size;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphEnd)));

    const endOfTextblock = vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    const firstEvent = pressKey(view, 'ArrowUp', { shiftKey: true });

    expect(firstEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(paragraphStart);
    expect(view.state.selection.to).toBe(paragraphEnd);
    expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe('outside');

    const secondEvent = pressKey(view, 'ArrowUp', { shiftKey: true });

    expect(secondEvent.defaultPrevented).toBe(false);
    expect(view.state.selection.from).toBe(paragraphStart);
    expect(view.state.selection.to).toBe(paragraphEnd);

    endOfTextblock.mockRestore();
    await editor.destroy();
  });

  it('applies the same first-step boundary guard before a following list', async () => {
    const editor = createEditor();
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph.create(null, schema.text('outside'));
    const list = schema.nodes.bullet_list.create(null, [
      schema.nodes.list_item.create(null, [
        schema.nodes.paragraph.create(null, schema.text('inside')),
      ]),
    ]);
    replaceDocument(view, [paragraph, list]);

    const paragraphStart = 1;
    const paragraphEnd = paragraphStart + paragraph.content.size;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphStart)));

    const endOfTextblock = vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    const firstEvent = pressKey(view, 'ArrowDown', { shiftKey: true });

    expect(firstEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(paragraphStart);
    expect(view.state.selection.to).toBe(paragraphEnd);
    expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe('outside');

    const secondEvent = pressKey(view, 'ArrowDown', { shiftKey: true });

    expect(secondEvent.defaultPrevented).toBe(false);
    expect(view.state.selection.from).toBe(paragraphStart);
    expect(view.state.selection.to).toBe(paragraphEnd);

    endOfTextblock.mockRestore();
    await editor.destroy();
  });
});
