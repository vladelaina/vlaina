// Drag plugin types
import type { Node } from '@milkdown/kit/prose/model';

export interface DragState {
  isDragging: boolean;
  draggedNode: Node | null;
  draggedPos: number;
  dropTarget: { pos: number; side: 'before' | 'after' } | null;
}

export interface DragHandleState {
  visible: boolean;
  position: { x: number; y: number };
  nodePos: number;
}