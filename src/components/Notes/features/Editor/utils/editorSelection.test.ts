import { describe, expect, it, vi } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { syncEditorSelectionFromDOM } from './editorSelection';

function createView() {
  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph' },
      paragraph: { content: 'text*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }] },
      text: { group: 'inline' },
    },
  });
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('m的')])]);
  const dom = document.createElement('div');
  const textNode = document.createTextNode('m的');
  dom.appendChild(textNode);
  document.body.appendChild(dom);
  const dispatch = vi.fn();
  const view = {
    dom,
    state: {
      doc,
      selection: TextSelection.create(doc, 2),
      tr: { setSelection: (selection: unknown) => ({ setMeta: () => ({ selection }) }) },
    },
    posAtDOM: (_node: Node, offset: number) => offset + 1,
    dispatch,
  };
  return { dispatch, dom, textNode, view };
}

describe('syncEditorSelectionFromDOM', () => {
  it('copies the native caret into the editor state before window blur', () => {
    const { dispatch, dom, textNode, view } = createView();
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selection.anchorNode).toBe(textNode);
    expect(view.posAtDOM(textNode, 2)).toBe(3);
    expect(syncEditorSelectionFromDOM(view as never)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dom.contains(selection.anchorNode)).toBe(true);
    dom.remove();
  });

  it('does not import a selection outside the editor', () => {
    const { dispatch, dom, view } = createView();
    const outside = document.createTextNode('outside');
    document.body.appendChild(outside);
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.setStart(outside, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(syncEditorSelectionFromDOM(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    outside.remove();
    dom.remove();
  });
});
