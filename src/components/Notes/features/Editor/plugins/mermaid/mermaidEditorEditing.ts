interface MermaidNodeLike {
  type: { name: string };
  attrs: Record<string, unknown> & { code?: string };
}

interface MermaidEditorViewLike<TTransaction> {
  dom?: {
    dispatchEvent?: (event: Event) => boolean;
  };
  state: {
    doc: {
      content?: {
        size?: number;
      };
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

function markMermaidUserInput(editorView: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  editorView.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function getMermaidNodeAt<TTransaction>(
  editorView: MermaidEditorViewLike<TTransaction>,
  nodePos: number,
): MermaidNodeLike | null {
  const docSize = editorView.state.doc.content?.size;
  if (!Number.isFinite(nodePos) || nodePos < 0) {
    return null;
  }
  if (typeof docSize === 'number' && nodePos > docSize) {
    return null;
  }

  try {
    const node = editorView.state.doc.nodeAt(nodePos);
    return node?.type.name === 'mermaid' ? node : null;
  } catch {
    return null;
  }
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
  const node = getMermaidNodeAt(editorView, nodePos);
  if (!node) {
    return false;
  }

  const tr = editorView.state.tr.delete(nodePos, nodePos + 1);
  markMermaidUserInput(editorView);
  editorView.dispatch(tr);
  return true;
}

export function applyMermaidNodeCode<TTransaction>(
  editorView: MermaidEditorViewLike<TTransaction>,
  nodePos: number,
  code: string
) {
  const node = getMermaidNodeAt(editorView, nodePos);
  if (!node) {
    return false;
  }

  if (node.attrs.code === code) {
    return false;
  }

  const tr = editorView.state.tr.setNodeMarkup(nodePos, undefined, {
    ...node.attrs,
    code,
  });
  markMermaidUserInput(editorView);
  editorView.dispatch(tr);
  return true;
}
