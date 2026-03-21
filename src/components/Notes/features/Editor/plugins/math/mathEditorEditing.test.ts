import { describe, expect, it, vi } from 'vitest';
import { applyMathNodeLatex } from './mathEditorEditing';

function createEditorView(node: {
  type: { name: string };
  attrs: { latex?: string; id?: string };
} | null) {
  const transaction = { kind: 'transaction' };
  const setNodeMarkup = vi.fn(() => transaction);
  const dispatch = vi.fn();

  return {
    editorView: {
      state: {
        doc: {
          nodeAt: vi.fn(() => node),
        },
        tr: {
          setNodeMarkup,
        },
      },
      dispatch,
    },
    setNodeMarkup,
    dispatch,
    transaction,
  };
}

describe('mathEditorEditing', () => {
  it('updates a math node so inline editing can preview changes live in the document', () => {
    const { editorView, setNodeMarkup, dispatch, transaction } = createEditorView({
      type: { name: 'math_inline' },
      attrs: { latex: 'x', id: 'node-1' },
    });

    const updated = applyMathNodeLatex(editorView, 7, 'x+1');

    expect(updated).toBe(true);
    expect(setNodeMarkup).toHaveBeenCalledWith(7, undefined, {
      latex: 'x+1',
      id: 'node-1',
    });
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('skips dispatching when the latex has not changed', () => {
    const { editorView, setNodeMarkup, dispatch } = createEditorView({
      type: { name: 'math_block' },
      attrs: { latex: 'x^2' },
    });

    const updated = applyMathNodeLatex(editorView, 3, 'x^2');

    expect(updated).toBe(false);
    expect(setNodeMarkup).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips dispatching for non-math nodes and invalid positions', () => {
    const nonMath = createEditorView({
      type: { name: 'paragraph' },
      attrs: { latex: 'x' },
    });
    const missing = createEditorView(null);

    expect(applyMathNodeLatex(nonMath.editorView, 4, 'y')).toBe(false);
    expect(applyMathNodeLatex(missing.editorView, 4, 'y')).toBe(false);
    expect(applyMathNodeLatex(missing.editorView, -1, 'y')).toBe(false);
    expect(nonMath.setNodeMarkup).not.toHaveBeenCalled();
    expect(nonMath.dispatch).not.toHaveBeenCalled();
    expect(missing.setNodeMarkup).not.toHaveBeenCalled();
    expect(missing.dispatch).not.toHaveBeenCalled();
  });
});
