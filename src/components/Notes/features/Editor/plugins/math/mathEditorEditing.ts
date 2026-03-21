interface MathNodeLike {
  type: { name: string };
  attrs: Record<string, unknown> & { latex?: string };
}

interface MathEditorViewLike<TTransaction> {
  state: {
    doc: {
      nodeAt: (pos: number) => MathNodeLike | null;
    };
    tr: {
      setNodeMarkup: (
        pos: number,
        type: undefined,
        attrs: Record<string, unknown>
      ) => TTransaction;
    };
  };
  dispatch: (tr: TTransaction) => void;
}

export function applyMathNodeLatex<TTransaction>(
  editorView: MathEditorViewLike<TTransaction>,
  nodePos: number,
  latex: string
): boolean {
  if (nodePos < 0) {
    return false;
  }

  const node = editorView.state.doc.nodeAt(nodePos);
  if (!node || (node.type.name !== 'math_block' && node.type.name !== 'math_inline')) {
    return false;
  }

  if (node.attrs.latex === latex) {
    return false;
  }

  const tr = editorView.state.tr.setNodeMarkup(nodePos, undefined, {
    ...node.attrs,
    latex,
  });
  editorView.dispatch(tr);
  return true;
}
