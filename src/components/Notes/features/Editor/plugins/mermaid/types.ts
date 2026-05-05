export interface MermaidAttrs {
  code: string;
}

export type MermaidEditorOpenSource = 'existing-node' | 'new-empty-block';

export interface MermaidEditorState {
  isOpen: boolean;
  code: string;
  position: { x: number; y: number };
  nodePos: number;
  openSource: MermaidEditorOpenSource | null;
}
