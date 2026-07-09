import type { PointerEvent } from 'react';
import type { WhiteboardElement, WhiteboardPoint, WhiteboardStroke, WhiteboardViewport } from './whiteboardModel';
import type { WhiteboardResizeHandle, WhiteboardSelectionRect } from './whiteboardSelection';

export type WhiteboardDragState =
  | {
    kind: 'move';
    id: string;
    offsetX: number;
    offsetY: number;
  }
  | {
    kind: 'move-elements';
    elementIds: string[];
    currentPoint: WhiteboardPoint;
    originalElementsById: Map<string, WhiteboardElement>;
    originalStrokesById: Map<string, WhiteboardStroke>;
    startPoint: WhiteboardPoint;
    strokeIds: string[];
  }
  | {
    kind: 'resize';
    aspectRatio: number;
    id: string;
    preserveAspectRatio: boolean;
    startPoint: WhiteboardPoint;
    startWidth: number;
    startHeight: number;
  }
  | {
    bounds: WhiteboardSelectionRect;
    handle: WhiteboardResizeHandle;
    kind: 'resize-selection';
    originalElementsById: Map<string, WhiteboardElement>;
    originalStrokesById: Map<string, WhiteboardStroke>;
    preserveAspectRatio: boolean;
    startPoint: WhiteboardPoint;
  }
  | {
    kind: 'pan';
    startClientX: number;
    startClientY: number;
    startViewport: WhiteboardViewport;
  }
  | {
    kind: 'pinch';
    startCenter: WhiteboardPoint;
    startDistance: number;
    startViewport: WhiteboardViewport;
  }
  | {
    kind: 'move-strokes';
    currentPoint: WhiteboardPoint;
    originalStrokesById: Map<string, WhiteboardStroke>;
    startPoint: WhiteboardPoint;
    strokeIds: string[];
  }
  | {
    kind: 'lasso';
    points: WhiteboardPoint[];
  }
  | {
    kind: 'marquee';
    currentPoint: WhiteboardPoint;
    startPoint: WhiteboardPoint;
  }
  | {
    kind: 'draw';
  };

export interface WhiteboardMovePreview {
  dx: number;
  dy: number;
  elementIds: string[];
  strokeIds: string[];
}

export type WhiteboardMoveDragState = Extract<WhiteboardDragState, { kind: 'move-elements' | 'move-strokes' }>;

export function isWhiteboardMoveDragState(state: WhiteboardDragState | null): state is WhiteboardMoveDragState {
  return state?.kind === 'move-elements' || state?.kind === 'move-strokes';
}

export function getWhiteboardMovePreview(state: WhiteboardDragState | null): WhiteboardMovePreview | null {
  if (!isWhiteboardMoveDragState(state)) return null;
  return {
    dx: state.currentPoint.x - state.startPoint.x,
    dy: state.currentPoint.y - state.startPoint.y,
    elementIds: state.kind === 'move-elements' ? state.elementIds : [],
    strokeIds: state.strokeIds,
  };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

export function getCoalescedPointerEvents(event: PointerEvent): globalThis.PointerEvent[] {
  const nativeEvent = event.nativeEvent;
  const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
  return events.length > 0 ? events : [nativeEvent];
}
