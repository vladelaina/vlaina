import type { MathEditorState } from './types';

export function createInitialMathEditorState(): MathEditorState {
  return {
    isOpen: false,
    latex: '',
    displayMode: false,
    position: { x: 0, y: 0 },
    nodePos: -1,
  };
}
