import { describe, expect, it, vi } from 'vitest';
import { applyMermaidNodeCode, removeMermaidNode } from './mermaidEditorEditing';

function createEditorView(node: {
  type: { name: string };
  attrs: { code?: string; id?: string };
} | null) {
  const transaction = { kind: 'transaction' };
  const setNodeMarkup = vi.fn(() => transaction);
  const deleteNode = vi.fn(() => transaction);
  const dispatch = vi.fn();

  return {
    editorView: {
      state: {
        doc: {
          nodeAt: vi.fn(() => node),
        },
        tr: {
          setNodeMarkup,
          delete: deleteNode,
        },
      },
      dispatch,
    },
    setNodeMarkup,
    deleteNode,
    dispatch,
    transaction,
  };
}

describe('mermaidEditorEditing', () => {
  it('updates a mermaid node so editing can preview changes live in the document', () => {
    const { editorView, setNodeMarkup, dispatch, transaction } = createEditorView({
      type: { name: 'mermaid' },
      attrs: { code: 'graph TD', id: 'node-1' },
    });

    const updated = applyMermaidNodeCode(editorView, 7, 'graph TD\nA --> B');

    expect(updated).toBe(true);
    expect(setNodeMarkup).toHaveBeenCalledWith(7, undefined, {
      code: 'graph TD\nA --> B',
      id: 'node-1',
    });
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('skips dispatching when the code has not changed', () => {
    const { editorView, setNodeMarkup, dispatch } = createEditorView({
      type: { name: 'mermaid' },
      attrs: { code: 'graph TD' },
    });

    const updated = applyMermaidNodeCode(editorView, 3, 'graph TD');

    expect(updated).toBe(false);
    expect(setNodeMarkup).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips dispatching for non-mermaid nodes and invalid positions', () => {
    const nonMermaid = createEditorView({
      type: { name: 'paragraph' },
      attrs: { code: 'graph TD' },
    });
    const missing = createEditorView(null);

    expect(applyMermaidNodeCode(nonMermaid.editorView, 4, 'x')).toBe(false);
    expect(applyMermaidNodeCode(missing.editorView, 4, 'x')).toBe(false);
    expect(applyMermaidNodeCode(missing.editorView, -1, 'x')).toBe(false);
    expect(nonMermaid.setNodeMarkup).not.toHaveBeenCalled();
    expect(nonMermaid.dispatch).not.toHaveBeenCalled();
    expect(missing.setNodeMarkup).not.toHaveBeenCalled();
    expect(missing.dispatch).not.toHaveBeenCalled();
  });

  it('removes a mermaid node when a newly created empty diagram is cancelled', () => {
    const { editorView, deleteNode, dispatch, transaction } = createEditorView({
      type: { name: 'mermaid' },
      attrs: { code: '' },
    });

    const removed = removeMermaidNode(editorView, 4);

    expect(removed).toBe(true);
    expect(deleteNode).toHaveBeenCalledWith(4, 5);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('skips removing non-mermaid nodes and invalid positions', () => {
    const nonMermaid = createEditorView({
      type: { name: 'paragraph' },
      attrs: {},
    });
    const missing = createEditorView(null);

    expect(removeMermaidNode(nonMermaid.editorView, 2)).toBe(false);
    expect(removeMermaidNode(missing.editorView, 2)).toBe(false);
    expect(removeMermaidNode(missing.editorView, -1)).toBe(false);
    expect(nonMermaid.deleteNode).not.toHaveBeenCalled();
    expect(nonMermaid.dispatch).not.toHaveBeenCalled();
    expect(missing.deleteNode).not.toHaveBeenCalled();
    expect(missing.dispatch).not.toHaveBeenCalled();
  });
});
