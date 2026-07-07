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
    originalElements: WhiteboardElement[];
    originalStrokes: WhiteboardStroke[];
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
    originalElements: WhiteboardElement[];
    originalStrokes: WhiteboardStroke[];
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
    originalStrokes: WhiteboardStroke[];
    startPoint: WhiteboardPoint;
    strokeIds: string[];
  }
  | {
    kind: 'marquee';
    currentPoint: WhiteboardPoint;
    startPoint: WhiteboardPoint;
  }
  | {
    kind: 'draw';
  };

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

export function getCoalescedPointerEvents(event: PointerEvent): globalThis.PointerEvent[] {
  const nativeEvent = event.nativeEvent;
  const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
  return events.length > 0 ? events : [nativeEvent];
}
