// Math plugin types

export interface MathBlockAttrs {
  latex: string;
}

export interface MathInlineAttrs {
  latex: string;
}

export interface MathEditorState {
  isOpen: boolean;
  latex: string;
  displayMode: boolean;
  position: { x: number; y: number };
  nodePos: number;
}