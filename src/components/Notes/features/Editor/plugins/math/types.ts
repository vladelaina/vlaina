export interface MathBlockAttrs {
  latex: string;
}

export interface MathInlineAttrs {
  latex: string;
}

export type MathEditorOpenSource = 'existing-node' | 'new-empty-block';

export interface MathEditorState {
  isOpen: boolean;
  latex: string;
  displayMode: boolean;
  position: { x: number; y: number };
  nodePos: number;
  openSource: MathEditorOpenSource | null;
}
