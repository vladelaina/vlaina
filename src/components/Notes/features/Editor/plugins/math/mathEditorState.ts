import type { MathEditorOpenSource, MathEditorState } from './types';

const CLOSED_POSITION = { x: 0, y: 0 };

export function createClosedMathEditorState(): MathEditorState {
  return {
    isOpen: false,
    latex: '',
    displayMode: false,
    position: CLOSED_POSITION,
    nodePos: -1,
    openSource: null,
  };
}

export function createOpenMathEditorState(args: {
  latex: string;
  displayMode: boolean;
  position: { x: number; y: number };
  nodePos: number;
  openSource: MathEditorOpenSource;
}): MathEditorState {
  const { latex, displayMode, position, nodePos, openSource } = args;

  return {
    isOpen: true,
    latex,
    displayMode,
    position,
    nodePos,
    openSource,
  };
}

export function shouldDiscardEmptyMathNodeOnCancel(
  state: MathEditorState | null | undefined,
  draftLatex: string
): boolean {
  if (!state?.isOpen || state.openSource !== 'new-empty-block' || state.nodePos < 0) {
    return false;
  }

  return !state.latex.trim() && !draftLatex.trim();
}
