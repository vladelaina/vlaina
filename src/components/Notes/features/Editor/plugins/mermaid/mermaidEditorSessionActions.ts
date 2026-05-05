import type { EditorView } from '@milkdown/kit/prose/view';
import { applyMermaidNodeCode, removeMermaidNode } from './mermaidEditorEditing';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import {
  createClosedMermaidEditorState,
  shouldDiscardEmptyMermaidNodeOnCancel,
} from './mermaidEditorState';
import type { MermaidEditorState } from './types';

export interface MermaidEditorSessionRefs {
  textareaElement: HTMLTextAreaElement | null;
  draftCode: string;
  initialCode: string;
}

interface MermaidEditorSessionActionArgs {
  editorView: EditorView;
  refs: MermaidEditorSessionRefs;
  getEditorState: () => MermaidEditorState | undefined;
  resetSessionDom: () => void;
}

function closeMermaidEditorSession(args: MermaidEditorSessionActionArgs) {
  const { editorView, resetSessionDom } = args;
  resetSessionDom();
  editorView.dispatch(
    editorView.state.tr.setMeta(mermaidEditorPluginKey, createClosedMermaidEditorState())
  );
}

function resolveCurrentDraftCode(
  refs: MermaidEditorSessionRefs,
  nextDraftCode?: string
) {
  if (typeof nextDraftCode === 'string') {
    refs.draftCode = nextDraftCode;
    return refs.draftCode;
  }

  if (refs.textareaElement) {
    refs.draftCode = refs.textareaElement.value;
  }

  return refs.draftCode;
}

function restoreOriginalCode(args: MermaidEditorSessionActionArgs, state: MermaidEditorState) {
  applyMermaidNodeCode(
    args.editorView,
    state.nodePos,
    args.refs.initialCode || state.code
  );
}

export function cancelMermaidEditorSession(args: MermaidEditorSessionActionArgs) {
  const state = args.getEditorState();
  const draftCode = resolveCurrentDraftCode(args.refs);

  if (state && shouldDiscardEmptyMermaidNodeOnCancel(state, draftCode)) {
    removeMermaidNode(args.editorView as never, state.nodePos);
  } else if (state) {
    restoreOriginalCode(args, state);
  }

  closeMermaidEditorSession(args);
  args.editorView.focus();
}

export function saveMermaidEditorSession(args: MermaidEditorSessionActionArgs) {
  const state = args.getEditorState();
  if (!state || state.nodePos < 0) {
    closeMermaidEditorSession(args);
    return;
  }

  const draftCode = resolveCurrentDraftCode(args.refs);
  if (!draftCode.trim()) {
    removeMermaidNode(args.editorView as never, state.nodePos);
  } else {
    applyMermaidNodeCode(args.editorView, state.nodePos, draftCode);
  }

  closeMermaidEditorSession(args);
  args.editorView.focus();
}
