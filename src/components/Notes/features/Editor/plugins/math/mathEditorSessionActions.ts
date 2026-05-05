import type { EditorView } from '@milkdown/kit/prose/view';
import { applyMathNodeLatex, removeMathNode } from './mathEditorEditing';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import { createClosedMathEditorState, shouldDiscardEmptyMathNodeOnCancel } from './mathEditorState';
import type { MathEditorState } from './types';

export interface MathEditorSessionRefs {
  textareaElement: HTMLTextAreaElement | null;
  draftLatex: string;
  initialLatex: string;
}

interface MathEditorSessionActionArgs {
  editorView: EditorView;
  refs: MathEditorSessionRefs;
  getEditorState: () => MathEditorState | undefined;
  resetSessionDom: () => void;
}

function closeMathEditorSession(args: MathEditorSessionActionArgs) {
  const { editorView, resetSessionDom } = args;
  resetSessionDom();
  editorView.dispatch(
    editorView.state.tr.setMeta(mathEditorPluginKey, createClosedMathEditorState())
  );
}

function resolveCurrentDraftLatex(
  refs: MathEditorSessionRefs,
  nextDraftLatex?: string
) {
  if (typeof nextDraftLatex === 'string') {
    refs.draftLatex = nextDraftLatex;
    return refs.draftLatex;
  }

  if (refs.textareaElement) {
    refs.draftLatex = refs.textareaElement.value;
  }

  return refs.draftLatex;
}

function restoreOriginalLatex(args: MathEditorSessionActionArgs, state: MathEditorState) {
  applyMathNodeLatex(
    args.editorView,
    state.nodePos,
    args.refs.initialLatex || state.latex
  );
}

export function cancelMathEditorSession(args: MathEditorSessionActionArgs) {
  const state = args.getEditorState();
  const draftLatex = resolveCurrentDraftLatex(args.refs);

  if (state && shouldDiscardEmptyMathNodeOnCancel(state, draftLatex)) {
    removeMathNode(args.editorView as never, state.nodePos);
  } else if (state) {
    restoreOriginalLatex(args, state);
  }

  closeMathEditorSession(args);
  args.editorView.focus();
}

export function saveMathEditorSession(args: MathEditorSessionActionArgs) {
  const state = args.getEditorState();
  if (!state || state.nodePos < 0) {
    closeMathEditorSession(args);
    return;
  }

  const draftLatex = resolveCurrentDraftLatex(args.refs);
  if (!draftLatex.trim()) {
    removeMathNode(args.editorView as never, state.nodePos);
  } else {
    applyMathNodeLatex(args.editorView, state.nodePos, draftLatex);
  }

  closeMathEditorSession(args);
  args.editorView.focus();
}
