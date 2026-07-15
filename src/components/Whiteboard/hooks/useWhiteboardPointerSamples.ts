import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';
import { getCoalescedPointerEvents } from '../model/whiteboardInteractions';
import { createResponsiveStrokePoints, type WhiteboardStrokeInputState } from '../model/whiteboardStrokeInput';
import type { WhiteboardEraserSample } from '../model/whiteboardEraser';
import type {
  WhiteboardBrushSizes,
  WhiteboardDrawingTool,
  WhiteboardPoint,
  WhiteboardTool,
  WhiteboardViewport,
} from '../model/whiteboardModel';

interface WhiteboardPointerSamplesOptions {
  brushSizes: WhiteboardBrushSizes;
  getBoardPointFromRect: (clientX: number, clientY: number, rect: DOMRectReadOnly) => WhiteboardPoint;
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useWhiteboardPointerSamples({
  brushSizes,
  getBoardPointFromRect,
  tool,
  viewport,
  viewportRef,
}: WhiteboardPointerSamplesOptions) {
  const strokeInputStateRef = useRef<WhiteboardStrokeInputState | null>(null);

  const collectStrokePoints = useCallback((event: PointerEvent, drawingTool: WhiteboardDrawingTool, rect?: DOMRectReadOnly) => {
    const viewportRect = rect ?? viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return [];
    const result = createResponsiveStrokePoints(drawingTool, getCoalescedPointerEvents(event).map((coalescedEvent) => ({
      point: getBoardPointFromRect(coalescedEvent.clientX, coalescedEvent.clientY, viewportRect),
      pointerType: coalescedEvent.pointerType,
      pressure: coalescedEvent.pressure,
      screenPoint: { x: coalescedEvent.clientX, y: coalescedEvent.clientY },
      timeStamp: coalescedEvent.timeStamp,
    })), strokeInputStateRef.current);
    strokeInputStateRef.current = result.state;
    return result.points;
  }, [getBoardPointFromRect, viewportRef]);

  const collectEraserSamples = useCallback((event: PointerEvent, rect?: DOMRectReadOnly): WhiteboardEraserSample[] => {
    const viewportRect = rect ?? viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return [];
    return getCoalescedPointerEvents(event).map((coalescedEvent) => ({
      point: getBoardPointFromRect(coalescedEvent.clientX, coalescedEvent.clientY, viewportRect),
      size: tool === 'stroke-eraser' ? brushSizes['stroke-eraser'] : 1 / viewport.zoom,
    }));
  }, [brushSizes, getBoardPointFromRect, tool, viewport.zoom, viewportRef]);

  const resetStrokeInput = useCallback(() => {
    strokeInputStateRef.current = null;
  }, []);

  return { collectEraserSamples, collectStrokePoints, resetStrokeInput };
}
