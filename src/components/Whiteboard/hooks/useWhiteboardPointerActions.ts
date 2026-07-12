import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  getCoalescedPointerEvents,
  getWhiteboardMovePreview,
  isWhiteboardMoveDragState,
  type WhiteboardDragState,
} from '../model/whiteboardInteractions';
import { createWhiteboardElementFromDrag } from '../model/whiteboardElementCreation';
import {
  clampWhiteboardZoom,
  createStrokePoint,
  isBrushTool,
  isDrawingTool,
  screenPointToBoardPoint,
  type WhiteboardBrushColors,
  type WhiteboardBrushSizes,
  type WhiteboardDrawingTool,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardStrokePoint,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';
import {
  getRectFromPoints,
} from '../model/whiteboardSelection';
import { getStrokePointMinDistance, type WhiteboardEraserPoint } from '../model/whiteboardStrokeGeometry';
import {
  useWhiteboardLassoDragScheduler,
  useWhiteboardMoveDragScheduler,
} from './useWhiteboardMoveDragScheduler';

interface WhiteboardPointerActionsOptions {
  activePenPointerRef: MutableRefObject<number | null>;
  appendDraftPoints: (tool: WhiteboardDrawingTool, points: WhiteboardStrokePoint[], minDistance?: number) => void;
  beginRulerStroke: () => void;
  brushColors: WhiteboardBrushColors;
  brushSizes: WhiteboardBrushSizes;
  clearDraftStroke: () => void;
  dragState: WhiteboardDragState | null;
  getBoardPointFromRect: (clientX: number, clientY: number, rect: DOMRectReadOnly) => WhiteboardPoint;
  getPinchMetrics: () => { center: WhiteboardPoint; distance: number } | null;
  pushHistory: () => void;
  resizeSelection: (state: Extract<WhiteboardDragState, { kind: 'resize-selection' }>, point: WhiteboardPoint) => void;
  scheduleElementResize: (state: WhiteboardDragState, point: WhiteboardPoint) => void;
  scheduleEraserPoints: (points: WhiteboardEraserPoint[]) => void;
  scheduleViewport: (update: SetStateAction<WhiteboardViewport>) => void;
  setBrushCursorPoint: (point: WhiteboardPoint | null) => void;
  setConnectorSourceId: Dispatch<SetStateAction<string | null>>;
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setDraftStroke: (stroke: WhiteboardStroke | null) => void;
  setPointer: (pointerId: number, clientX: number, clientY: number) => WhiteboardPoint;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  showRulerAt: (point: WhiteboardPoint) => void;
  snapStrokePointsToRuler: (points: WhiteboardStrokePoint[], zoom: number) => WhiteboardStrokePoint[];
  spacePressedRef: MutableRefObject<boolean>;
  startStrokeSelection: (point: WhiteboardPoint, event: PointerEvent<HTMLDivElement>) => void;
  strokeIdRef: MutableRefObject<number>;
  tool: WhiteboardTool;
  updateRulerDrag: (point: WhiteboardPoint) => boolean;
  viewport: WhiteboardViewport;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useWhiteboardPointerActions({
  activePenPointerRef,
  appendDraftPoints,
  beginRulerStroke,
  brushColors,
  brushSizes,
  clearDraftStroke,
  dragState,
  getBoardPointFromRect,
  getPinchMetrics,
  pushHistory,
  resizeSelection,
  scheduleElementResize,
  scheduleEraserPoints,
  scheduleViewport,
  setBrushCursorPoint,
  setConnectorSourceId,
  setDragState,
  setDraftStroke,
  setPointer,
  setSelectedConnectorIds,
  setSelectedElementId,
  setSelectedStrokeIds,
  showRulerAt,
  snapStrokePointsToRuler,
  spacePressedRef,
  startStrokeSelection,
  strokeIdRef,
  tool,
  updateRulerDrag,
  viewport,
  viewportRef,
}: WhiteboardPointerActionsOptions) {
  const scheduleMoveDragPoint = useWhiteboardMoveDragScheduler(setDragState);
  const scheduleLassoPoint = useWhiteboardLassoDragScheduler(setDragState);

  const collectStrokePoints = useCallback((event: PointerEvent, rect?: DOMRectReadOnly) => {
    const viewportRect = rect ?? viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return [];
    const points = getCoalescedPointerEvents(event).map((coalescedEvent) => createStrokePoint(
      getBoardPointFromRect(coalescedEvent.clientX, coalescedEvent.clientY, viewportRect),
      coalescedEvent.pressure,
    ));
    return snapStrokePointsToRuler(points, viewport.zoom);
  }, [getBoardPointFromRect, snapStrokePointsToRuler, viewport.zoom, viewportRef]);

  const startPan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: viewport,
    });
  }, [setDragState, viewport]);

  const startPinch = useCallback(() => {
    const metrics = getPinchMetrics();
    if (!metrics) return false;
    clearDraftStroke();
    setDragState({
      kind: 'pinch',
      startCenter: metrics.center,
      startDistance: metrics.distance,
      startViewport: viewport,
    });
    return true;
  }, [clearDraftStroke, getPinchMetrics, setDragState, viewport]);

  const eraseAtEvent = useCallback((event: PointerEvent, rect?: DOMRectReadOnly) => {
    const viewportRect = rect ?? viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return;
    scheduleEraserPoints(getCoalescedPointerEvents(event).map((coalescedEvent) => ({
      point: getBoardPointFromRect(coalescedEvent.clientX, coalescedEvent.clientY, viewportRect),
      size: brushSizes.eraser,
    })));
  }, [brushSizes.eraser, getBoardPointFromRect, scheduleEraserPoints, viewportRef]);

  const handleViewportPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointer(event.pointerId, event.clientX, event.clientY);
    if (event.pointerType === 'pen') activePenPointerRef.current = event.pointerId;
    if (event.pointerType === 'touch' && activePenPointerRef.current !== null) return;
    if (event.pointerType === 'touch' && startPinch()) return;
    if (event.button === 1 || tool === 'hand' || spacePressedRef.current) {
      startPan(event);
      return;
    }
    if (event.pointerType === 'touch' && isBrushTool(tool)) {
      startPan(event);
      return;
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    const point = rect ? getBoardPointFromRect(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    if (tool !== 'connector') setSelectedConnectorIds([]);
    if (tool === 'ruler' && event.button === 0) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      showRulerAt(point);
      return;
    }
    if (isDrawingTool(tool) && event.button === 0) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      beginRulerStroke();
      setDraftStroke({
        color: brushColors[tool],
        id: `wb-stroke-${strokeIdRef.current}`,
        points: collectStrokePoints(event, rect ?? undefined),
        size: brushSizes[tool],
        tool,
      });
      setDragState({ kind: 'draw' });
      return;
    }
    if (tool === 'eraser' && event.button === 0) {
      setSelectedStrokeIds([]);
      setSelectedElementId(null);
      pushHistory();
      eraseAtEvent(event, rect ?? undefined);
      setDragState({ kind: 'draw' });
      return;
    }
    if ((tool === 'note' || tool === 'rect' || tool === 'ellipse') && event.button === 0) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      setDragState({ currentPoint: point, kind: 'create-element', startPoint: point, type: tool });
      return;
    }
    if (tool === 'select') {
      startStrokeSelection(point, event);
      return;
    }
    if (tool === 'connector') setConnectorSourceId(null);
  }, [
    activePenPointerRef, beginRulerStroke, brushColors, brushSizes, collectStrokePoints, eraseAtEvent,
    getBoardPointFromRect, pushHistory, setConnectorSourceId, setDraftStroke, setDragState, setPointer,
    setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, showRulerAt, spacePressedRef, startPan, startPinch,
    startStrokeSelection, strokeIdRef, tool, viewportRef,
  ]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setPointer(event.pointerId, event.clientX, event.clientY);
    const rect = viewportRef.current?.getBoundingClientRect();
    const point = rect ? getBoardPointFromRect(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    if (!dragState || dragState.kind === 'draw') setBrushCursorPoint(point);
    if (updateRulerDrag(point)) return;
    if (!dragState) return;
    if (dragState.kind === 'pinch') {
      const metrics = getPinchMetrics();
      if (!metrics) return;
      const boardPoint = screenPointToBoardPoint(dragState.startCenter, dragState.startViewport);
      const nextZoom = clampWhiteboardZoom(dragState.startViewport.zoom * (metrics.distance / dragState.startDistance));
      scheduleViewport({
        x: Math.round((metrics.center.x - boardPoint.x * nextZoom) * 100) / 100,
        y: Math.round((metrics.center.y - boardPoint.y * nextZoom) * 100) / 100,
        zoom: nextZoom,
      });
      return;
    }
    if (dragState.kind === 'pan') {
      scheduleViewport({
        ...dragState.startViewport,
        x: dragState.startViewport.x + event.clientX - dragState.startClientX,
        y: dragState.startViewport.y + event.clientY - dragState.startClientY,
      });
      return;
    }
    if (dragState.kind === 'draw') {
      if (tool === 'eraser') {
        eraseAtEvent(event, rect ?? undefined);
        return;
      }
      if (isDrawingTool(tool)) {
        appendDraftPoints(tool, collectStrokePoints(event, rect ?? undefined), getStrokePointMinDistance(viewport.zoom));
      }
      return;
    }
    if (dragState.kind === 'create-element' || dragState.kind === 'marquee') {
      setDragState({ ...dragState, currentPoint: point });
      return;
    }
    if (dragState.kind === 'lasso') {
      scheduleLassoPoint(point, viewport.zoom);
      return;
    }
    if (dragState.kind === 'resize-selection') {
      resizeSelection(dragState, point);
      return;
    }
    if (isWhiteboardMoveDragState(dragState)) {
      scheduleMoveDragPoint(point);
      return;
    }
    scheduleElementResize(dragState, point);
  }, [
    appendDraftPoints, collectStrokePoints, dragState, eraseAtEvent, getBoardPointFromRect,
    getPinchMetrics, resizeSelection, scheduleElementResize, scheduleLassoPoint, scheduleMoveDragPoint,
    scheduleViewport, setBrushCursorPoint, setDragState, setPointer, tool, updateRulerDrag, viewport.zoom,
    viewportRef,
  ]);

  return {
    draftElement: dragState?.kind === 'create-element'
      ? createWhiteboardElementFromDrag('wb-element-preview', dragState.type, dragState.startPoint, dragState.currentPoint)
      : null,
    handlePointerMove,
    handleViewportPointerDown,
    isPanning: dragState?.kind === 'pan',
    movePreview: getWhiteboardMovePreview(dragState),
    selectionPath: dragState?.kind === 'lasso' ? dragState.points : null,
    selectionRect: dragState?.kind === 'marquee'
      ? getRectFromPoints(dragState.startPoint, dragState.currentPoint)
      : null,
  };
}
