import type { MermaidEditorOpenSource, MermaidEditorState } from './types';

const CLOSED_POSITION = { x: 0, y: 0 };

export function createClosedMermaidEditorState(): MermaidEditorState {
  return {
    isOpen: false,
    code: '',
    position: CLOSED_POSITION,
    nodePos: -1,
    openSource: null,
  };
}

export function createOpenMermaidEditorState(args: {
  code: string;
  position: { x: number; y: number };
  nodePos: number;
  openSource: MermaidEditorOpenSource;
}): MermaidEditorState {
  const { code, position, nodePos, openSource } = args;

  return {
    isOpen: true,
    code,
    position,
    nodePos,
    openSource,
  };
}

export function shouldDiscardEmptyMermaidNodeOnCancel(
  state: MermaidEditorState | null | undefined,
  draftCode: string
) {
  if (!state?.isOpen || state.openSource !== 'new-empty-block' || state.nodePos < 0) {
    return false;
  }

  return !draftCode.trim() || draftCode.trim() === state.code.trim();
}

export function shouldRemoveMermaidNodeOnSave(
  state: MermaidEditorState | null | undefined,
  draftCode: string
) {
  if (!draftCode.trim()) {
    return true;
  }

  if (!state?.isOpen || state.openSource !== 'new-empty-block' || state.nodePos < 0) {
    return false;
  }

  return Boolean(state.code.trim()) && draftCode.trim() === state.code.trim();
}
