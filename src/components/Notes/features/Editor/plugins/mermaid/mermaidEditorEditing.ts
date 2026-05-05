interface MermaidNodeLike {
  type: { name: string };
  attrs: Record<string, unknown> & { code?: string };
}

interface MermaidEditorViewLike<TTransaction> {
  state: {
    doc: {
      nodeAt: (pos: number) => MermaidNodeLike | null;
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

export function removeMermaidNode<TTransaction>(
  editorView: MermaidEditorViewLike<TTransaction> & {
    state: MermaidEditorViewLike<TTransaction>['state'] & {
      tr: {
        delete: (from: number, to: number) => TTransaction;
      };
    };
  },
  nodePos: number
) {
  if (nodePos < 0) {
    return false;
  }

  const node = editorView.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'mermaid') {
    return false;
  }

  const tr = editorView.state.tr.delete(nodePos, nodePos + 1);
  editorView.dispatch(tr);
  return true;
}

export function applyMermaidNodeCode<TTransaction>(
  editorView: MermaidEditorViewLike<TTransaction>,
  nodePos: number,
  code: string
) {
  if (nodePos < 0) {
    return false;
  }

  const node = editorView.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'mermaid') {
    return false;
  }

  if (node.attrs.code === code) {
    return false;
  }

  const tr = editorView.state.tr.setNodeMarkup(nodePos, undefined, {
    ...node.attrs,
    code,
  });
  editorView.dispatch(tr);
  return true;
}
