import { useCallback, useRef, useState, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import { useWhiteboardBoardActions } from './useWhiteboardBoardActions';
import { useWhiteboardBrushCursor } from './useWhiteboardBrushCursor';
import { useWhiteboardBrushSizes } from './useWhiteboardBrushSizes';
import { useWhiteboardClipboard } from './useWhiteboardClipboard';
import { useWhiteboardDraftStroke } from './useWhiteboardDraftStroke';
import { useWhiteboardElementControls } from './useWhiteboardElementControls';
import { useWhiteboardEscapeKey } from './useWhiteboardEscapeKey';
import { useWhiteboardExport } from './useWhiteboardExport';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import { useWhiteboardImageImport } from './useWhiteboardImageImport';
import { useWhiteboardKeyboardShortcuts } from './useWhiteboardKeyboardShortcuts';
import { useWhiteboardMoveDragScheduler } from './useWhiteboardMoveDragScheduler';
import { loadWhiteboardSnapshot, useWhiteboardPersistence } from './useWhiteboardPersistence';
import { useWhiteboardReady } from './useWhiteboardReady';
import { useWhiteboardRuler } from './useWhiteboardRuler';
import { useWhiteboardSelectionDeletion } from './useWhiteboardSelectionDeletion';
import { useWhiteboardSpacePan } from './useWhiteboardSpacePan';
import { useWhiteboardStrokeSelection } from './useWhiteboardStrokeSelection';
import { useWhiteboardStorageBridge } from './useWhiteboardStorageBridge';
import { useWhiteboardTouchPointers } from './useWhiteboardTouchPointers';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import { getCoalescedPointerEvents, getWhiteboardMovePreview, isWhiteboardMoveDragState, type WhiteboardDragState } from '../model/whiteboardInteractions';
import {
  WHITEBOARD_INITIAL_VIEWPORT, WHITEBOARD_SEED_CONNECTORS, WHITEBOARD_SEED_ELEMENTS, WHITEBOARD_SEED_STROKES,
  clampWhiteboardZoom, createStrokePoint, isBrushTool, isDrawingTool,
  screenPointToBoardPoint,
  type WhiteboardBrushTool, type WhiteboardConnector, type WhiteboardElement, type WhiteboardPoint,
  type WhiteboardStroke, type WhiteboardTool,
} from '../model/whiteboardModel';
import { getElementsInRect, getRectFromPoints, getStrokesInRect, translateStrokesFromOriginals } from '../model/whiteboardSelection';
import { eraseStrokeAtPoint } from '../model/whiteboardStrokeGeometry';

interface WhiteboardControllerOptions {
  active: boolean; onPrimaryContentReady?: () => void; onStartupReady?: () => void;
}
export function useWhiteboardController({
  active,
  onPrimaryContentReady,
  onStartupReady,
}: WhiteboardControllerOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const initialSnapshotRef = useRef(loadWhiteboardSnapshot());
  const appliedBoardIdRef = useRef<string | null>(null);
  const activePenPointerRef = useRef<number | null>(null);
  const strokeIdRef = useRef(getNextWhiteboardIdSequence(initialSnapshotRef.current.strokes ?? WHITEBOARD_SEED_STROKES, 'wb-stroke-'));
  const connectorIdRef = useRef(getNextWhiteboardIdSequence(initialSnapshotRef.current.connectors ?? WHITEBOARD_SEED_CONNECTORS, 'wb-connector-'));
  const { brushColors, brushSizes, resizeBrush, setBrushColor } = useWhiteboardBrushSizes();
  const { appendDraftPoints, clearDraftStroke, draftStroke, getDraftStroke, setDraftStroke } = useWhiteboardDraftStroke();
  const { spacePressed, spacePressedRef } = useWhiteboardSpacePan(active);
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [viewport, setViewport] = useState(initialSnapshotRef.current.viewport ?? WHITEBOARD_INITIAL_VIEWPORT);
  const [elements, setElements] = useState<WhiteboardElement[]>(initialSnapshotRef.current.elements ?? WHITEBOARD_SEED_ELEMENTS);
  const [connectors, setConnectors] = useState<WhiteboardConnector[]>(initialSnapshotRef.current.connectors ?? WHITEBOARD_SEED_CONNECTORS);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(initialSnapshotRef.current.strokes ?? WHITEBOARD_SEED_STROKES);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const setSelectedElementId = useCallback<Dispatch<SetStateAction<string | null>>>((value) => setSelectedElementIds((current) => { const id = typeof value === 'function' ? value(current[0] ?? null) : value; return id ? [id] : []; }), []);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]); const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<WhiteboardDragState | null>(null); const scheduleMoveDragPoint = useWhiteboardMoveDragScheduler(setDragState);
  const { brushCursorPoint, setBrushCursorPoint } = useWhiteboardBrushCursor();
  const { canRedo, canUndo, pushHistory, redo, undo } = useWhiteboardHistory({ active, connectors, elements, setConnectors, setElements, setStrokes, strokes });
  const { beginRulerStroke, finishRulerDrag, finishRulerStroke, hideRuler, ruler, showRulerAt, snapStrokePointsToRuler, startRulerDrag, updateRulerDrag } = useWhiteboardRuler({ ...initialSnapshotRef.current.ruler, visible: false });
  useWhiteboardStorageBridge({
    active, appliedBoardIdRef, connectorIdRef, setConnectorSourceId, setConnectors,
    setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setViewport, strokeIdRef,
  });
  useWhiteboardReady(onStartupReady, onPrimaryContentReady);
  const persistenceStatus = useWhiteboardPersistence({ connectors, elements, ruler, strokes, viewport }, dragState !== null);
  useWhiteboardSelectionDeletion({
    active, pushHistory, selectedElementIds, selectedStrokeIds, setConnectors, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
  });
  useWhiteboardEscapeKey({ active, clearDraftStroke, setConnectorSourceId, setDragState, setSelectedElementId, setSelectedStrokeIds, setTool });
  const getViewportPoint = useCallback((clientX: number, clientY: number): WhiteboardPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);
  const getBoardPoint = useCallback((clientX: number, clientY: number): WhiteboardPoint => (
    screenPointToBoardPoint(getViewportPoint(clientX, clientY), viewport)), [getViewportPoint, viewport]);
  const { deletePointer, getPinchMetrics, setPointer } = useWhiteboardTouchPointers(getViewportPoint);
  const { handleElementPointerDown, handleResizePointerDown, handleSelectionResizePointerDown, moveOrResizeElement, resizeSelection, selectElement, setElementText } = useWhiteboardElementControls({
    elements, getBoardPoint, pushHistory, selectedElementIds, selectedStrokeIds, setDragState, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, strokes, tool,
  });
  const handleSurfaceDoubleClick = useCallback(() => undefined, []);
  const boardActions = useWhiteboardBoardActions({
    clearDraftStroke, connectors, elements, getViewportPoint, pushHistory, redo, resizeBrush,
    setConnectors, setConnectorSourceId, setDragState, setDraftStroke, setElements,
    setSelectedElementId, setSelectedStrokeIds, setStrokes, setViewport, spacePressedRef, strokes, tool, undo, viewportRef,
  });
  const { copyBoardToClipboard, exportBoard } = useWhiteboardExport({ connectors, elements, strokes, viewportRef });
  const importImage = useWhiteboardImageImport({ pushHistory, setElements, setSelectedElementId, setSelectedStrokeIds, setTool, viewport, viewportRef });
  const clipboard = useWhiteboardClipboard({
    active, connectors, elements, importImage, pushHistory, selectedElementIds, selectedStrokeIds,
    setConnectors, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setTool, strokes,
  });
  const startStrokeSelection = useWhiteboardStrokeSelection({ pushHistory, selectedStrokeIds, setDragState, setSelectedElementId, setSelectedStrokeIds, strokes, zoom: viewport.zoom });
  const handleToolChange = useCallback((nextTool: WhiteboardTool) => {
    if (nextTool !== 'ruler') { setTool(nextTool); return; }
    if (ruler.visible) { hideRuler(); setTool('select'); return; }
    setTool('ruler');
    const rect = viewportRef.current?.getBoundingClientRect();
    showRulerAt(screenPointToBoardPoint({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }, viewport));
  }, [hideRuler, ruler.visible, showRulerAt, viewport]);
  useWhiteboardKeyboardShortcuts({ active, elements, pushHistory, resizeBrush, selectedBrushTool: isBrushTool(tool) ? tool : null, selectedElementIds, selectedStrokeIds, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setTool: handleToolChange, strokes, viewportZoom: viewport.zoom });
  const handleRulerPointerDown = useCallback((event: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: 'move' | 'rotate') => {
    startRulerDrag(event, getBoardPoint(event.clientX, event.clientY), mode);
  }, [getBoardPoint, startRulerDrag]);
  const collectStrokePoints = useCallback((event: PointerEvent) => (
    snapStrokePointsToRuler(getCoalescedPointerEvents(event).map((coalescedEvent) => createStrokePoint(
      getBoardPoint(coalescedEvent.clientX, coalescedEvent.clientY),
      coalescedEvent.pressure,
    )), viewport.zoom)
  ), [getBoardPoint, snapStrokePointsToRuler, viewport.zoom]);
  const startPan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: viewport,
    });
  }, [viewport]);
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
  }, [clearDraftStroke, getPinchMetrics, viewport]);
  const eraseAtEvent = useCallback((event: PointerEvent) => {
    const point = getBoardPoint(event.clientX, event.clientY);
    setStrokes((current) => current.flatMap((stroke) => eraseStrokeAtPoint(stroke, point, brushSizes.eraser)));
  }, [brushSizes.eraser, getBoardPoint]);
  const handleConnectorTarget = useCallback((id: string) => {
    setSelectedElementId(id);
    setSelectedStrokeIds([]);
    setConnectorSourceId((sourceId) => {
      if (!sourceId) return id;
      if (sourceId === id) return null;
      pushHistory();
      const connectorId = `wb-connector-${connectorIdRef.current}`;
      connectorIdRef.current += 1;
      setConnectors((current) => [...current, { id: connectorId, fromId: sourceId, toId: id }]);
      return null;
    });
  }, [pushHistory]);
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
    const point = getBoardPoint(event.clientX, event.clientY);
    if (tool === 'ruler' && event.button === 0) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      showRulerAt(point);
      return;
    }
    if (isDrawingTool(tool) && event.button === 0) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      beginRulerStroke(); setDraftStroke({ color: brushColors[tool], id: `wb-stroke-${strokeIdRef.current}`, tool, size: brushSizes[tool], points: collectStrokePoints(event) });
      setDragState({ kind: 'draw' });
      return;
    }
    if (tool === 'eraser' && event.button === 0) {
      setSelectedStrokeIds([]);
      setSelectedElementId(null);
      pushHistory();
      eraseAtEvent(event);
      setDragState({ kind: 'draw' });
      return;
    }

    if (tool === 'select') {
      startStrokeSelection(point, event);
      return;
    }
    if (tool === 'connector') setConnectorSourceId(null);
  }, [
    brushColors, brushSizes, collectStrokePoints, eraseAtEvent, getBoardPoint, pushHistory,
    beginRulerStroke, setPointer, showRulerAt, spacePressedRef, startPan, startPinch, startStrokeSelection, tool,
  ]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setPointer(event.pointerId, event.clientX, event.clientY);
    const point = getBoardPoint(event.clientX, event.clientY);
    if (!dragState || dragState.kind === 'draw') setBrushCursorPoint(point);
    if (updateRulerDrag(point)) return;
    if (!dragState) return;
    if (dragState.kind === 'pinch') {
      const metrics = getPinchMetrics();
      if (!metrics) return;
      const boardPoint = screenPointToBoardPoint(dragState.startCenter, dragState.startViewport);
      const nextZoom = clampWhiteboardZoom(dragState.startViewport.zoom * (metrics.distance / dragState.startDistance));
      setViewport({
        x: Math.round((metrics.center.x - boardPoint.x * nextZoom) * 100) / 100,
        y: Math.round((metrics.center.y - boardPoint.y * nextZoom) * 100) / 100,
        zoom: nextZoom,
      });
      return;
    }
    if (dragState.kind === 'pan') {
      setViewport({
        ...dragState.startViewport,
        x: dragState.startViewport.x + event.clientX - dragState.startClientX,
        y: dragState.startViewport.y + event.clientY - dragState.startClientY,
      });
      return;
    }
    if (dragState.kind === 'draw') {
      if (tool === 'eraser') {
        eraseAtEvent(event);
        return;
      }
      if (isDrawingTool(tool)) appendDraftPoints(tool, collectStrokePoints(event));
      return;
    }
    if (dragState.kind === 'marquee') {
      setDragState({ ...dragState, currentPoint: point });
      return;
    }
    if (dragState.kind === 'resize-selection') { resizeSelection(dragState, point); return; }
    if (isWhiteboardMoveDragState(dragState)) {
      scheduleMoveDragPoint(point);
      return;
    }
    setElements((current) => current.map((element) => moveOrResizeElement(element, dragState, point)));
  }, [
    appendDraftPoints, collectStrokePoints, dragState, eraseAtEvent, getBoardPoint,
    getPinchMetrics, moveOrResizeElement, resizeSelection, scheduleMoveDragPoint, setPointer, tool, updateRulerDrag,
  ]);

  const finishPointerAction = useCallback((event?: PointerEvent<HTMLDivElement>) => {
    if (event) deletePointer(event.pointerId);
    finishRulerDrag(); finishRulerStroke();
    if (event?.pointerId === activePenPointerRef.current) activePenPointerRef.current = null;
    const currentDraft = getDraftStroke();
    if (dragState?.kind === 'draw' && currentDraft && currentDraft.points.length > 0) {
      pushHistory();
      setStrokes((current) => [...current, { ...currentDraft, id: `wb-stroke-${strokeIdRef.current}` }]);
      strokeIdRef.current += 1;
    }
    if (dragState?.kind === 'marquee') {
      const rect = getRectFromPoints(dragState.startPoint, dragState.currentPoint);
      setSelectedElementIds(rect.width < 3 && rect.height < 3 ? [] : getElementsInRect(elements, rect));
      setSelectedStrokeIds(rect.width < 3 && rect.height < 3 ? [] : getStrokesInRect(strokes, rect));
    }
    if (isWhiteboardMoveDragState(dragState)) {
      const point = event ? getBoardPoint(event.clientX, event.clientY) : dragState.currentPoint;
      const dx = point.x - dragState.startPoint.x;
      const dy = point.y - dragState.startPoint.y;
      if (dragState.kind === 'move-strokes' || dragState.originalStrokesById.size > 0) setStrokes((current) => translateStrokesFromOriginals(current, dragState.originalStrokesById, dx, dy));
      if (dragState.kind === 'move-elements') setElements((current) => current.map((element) => moveOrResizeElement(element, dragState, point)));
    }
    clearDraftStroke();
    setDragState(null);
  }, [clearDraftStroke, deletePointer, dragState, elements, finishRulerDrag, finishRulerStroke, getBoardPoint, getDraftStroke, moveOrResizeElement, pushHistory, strokes]);
  const movePreview = getWhiteboardMovePreview(dragState);
  return {
    brushCursorColor: isBrushTool(tool) && tool !== 'eraser' ? brushColors[tool] : 'transparent',
    brushCursorPoint,
    brushCursorSize: isBrushTool(tool) ? brushSizes[tool] : 1,
    brushCursorTool: isBrushTool(tool) ? tool : null as WhiteboardBrushTool | null,
    brushColors, brushSizes, canRedo, canUndo,
    clearBoard: boardActions.clearBoard,
    connectorSourceId, connectors, draftStroke, elements,
    copyBoardToClipboard, exportBoard, handleConnectorTarget, handleElementPointerDown, handlePointerMove, handleSurfaceDoubleClick, importImage,
    handleRedo: boardActions.handleRedo,
    handleResizePointerDown, handleRulerClose: hideRuler, handleRulerPointerDown, handleSelectionResizePointerDown, handleUndo: boardActions.handleUndo, handleViewportPointerDown, handleWheel: boardActions.handleWheel,
    fitView: boardActions.fitView,
    isPanning: dragState?.kind === 'pan',
    onCopy: clipboard.copySelection,
    onDuplicate: clipboard.duplicateSelection, onPaste: clipboard.pasteSelection, resetView: boardActions.resetView,
    persistenceStatus,
    movePreview,
    ruler,
    selectedElementIds, selectedStrokeIds,
    selectionRect: dragState?.kind === 'marquee' ? getRectFromPoints(dragState.startPoint, dragState.currentPoint) : null,
    resizeBrush, setBrushColor, setBrushCursorPoint, setElementText,
    setSelectedElementId: selectElement,
    setTool: handleToolChange, spacePressed, strokes, tool,
    updateZoom: boardActions.updateZoom, viewport, viewportRef, finishPointerAction,
  };
}
