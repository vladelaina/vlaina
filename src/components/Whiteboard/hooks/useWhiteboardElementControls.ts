import { useCallback, useEffect, useRef, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import type { WhiteboardDragState } from '../model/whiteboardInteractions';
import {
  resizeWhiteboardElement,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardTool,
} from '../model/whiteboardModel';
import {
  getResizedSelectionBounds,
  getSelectionBounds,
  resizeSelectionElements,
  resizeSelectionStrokes,
  type WhiteboardResizeHandle,
} from '../model/whiteboardSelection';

interface WhiteboardElementControlsOptions {
  elements: WhiteboardElement[];
  getBoardPoint: (clientX: number, clientY: number) => WhiteboardPoint;
  pushHistory: () => void;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
}

export function useWhiteboardElementControls({
  elements,
  getBoardPoint,
  pushHistory,
  selectedElementIds,
  selectedStrokeIds,
  setDragState,
  setElements,
  setSelectedConnectorIds,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  strokes,
  tool,
}: WhiteboardElementControlsOptions) {
  const elementResizeFrameRef = useRef<number | null>(null);
  const editingElementIdRef = useRef<string | null>(null);
  const selectionResizeFrameRef = useRef<number | null>(null);
  const pendingElementResizeRef = useRef<{ point: WhiteboardPoint; state: WhiteboardDragState } | null>(null);
  const pendingSelectionResizeRef = useRef<{ point: WhiteboardPoint; state: Extract<WhiteboardDragState, { kind: 'resize-selection' }> } | null>(null);

  const selectElement = useCallback((id: string) => {
    setSelectedConnectorIds([]);
    setSelectedElementIds([id]);
    setSelectedStrokeIds([]);
  }, [setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds]);

  const setElementText = useCallback((id: string, text: string) => {
    setElements((current) => current.map((item) => (item.id === id ? { ...item, text } : item)));
  }, [setElements]);

  const beginElementTextEdit = useCallback((id: string) => {
    if (editingElementIdRef.current === id) return;
    pushHistory();
    editingElementIdRef.current = id;
  }, [pushHistory]);

  const endElementTextEdit = useCallback((id: string) => {
    if (editingElementIdRef.current === id) editingElementIdRef.current = null;
  }, []);

  const handleElementPointerDown = useCallback((event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => {
    event.stopPropagation();
    if (tool === 'connector') return;
    if (tool !== 'select' || event.button !== 0) return;
    const point = getBoardPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    const keepStrokeSelection = event.shiftKey || selectedElementIds.includes(element.id);
    const nextIds = getNextElementSelection(selectedElementIds, element.id, event.shiftKey);
    setSelectedConnectorIds([]);
    setSelectedElementIds(nextIds);
    if (!keepStrokeSelection) setSelectedStrokeIds([]);
    if (event.shiftKey) return;
    if (nextIds.length === 0) return;
    pushHistory();
    const movingStrokeIds = keepStrokeSelection ? selectedStrokeIds : [];
    const originalElements = elements.filter((item) => nextIds.includes(item.id));
    const originalStrokes = strokes.filter((stroke) => movingStrokeIds.includes(stroke.id));
    setDragState({
      kind: 'move-elements',
      elementIds: nextIds,
      currentPoint: point,
      originalElementsById: new Map(originalElements.map((item) => [item.id, item])),
      originalStrokesById: new Map(originalStrokes.map((stroke) => [stroke.id, stroke])),
      startPoint: point,
      strokeIds: movingStrokeIds,
    });
  }, [elements, getBoardPoint, pushHistory, selectedElementIds, selectedStrokeIds, setDragState, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, strokes, tool]);

  const handleResizePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => {
    event.stopPropagation();
    const point = getBoardPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    selectElement(element.id);
    pushHistory();
    setDragState({
      aspectRatio: element.width / Math.max(1, element.height),
      id: element.id,
      kind: 'resize',
      preserveAspectRatio: element.type === 'image' || event.shiftKey,
      startHeight: element.height,
      startPoint: point,
      startWidth: element.width,
    });
  }, [getBoardPoint, pushHistory, selectElement, setDragState]);

  const moveOrResizeElement = useCallback((element: WhiteboardElement, dragState: WhiteboardDragState, point: WhiteboardPoint) => {
    if (dragState.kind === 'move') {
      return element.id === dragState.id ? { ...element, x: Math.round(point.x - dragState.offsetX), y: Math.round(point.y - dragState.offsetY) } : element;
    }
    if (dragState.kind === 'move-elements') {
      const original = dragState.originalElementsById.get(element.id);
      return original ? { ...element, x: Math.round(original.x + point.x - dragState.startPoint.x), y: Math.round(original.y + point.y - dragState.startPoint.y) } : element;
    }
    if (dragState.kind !== 'resize') return element;
    if (element.id !== dragState.id) return element;
    const width = dragState.startWidth + point.x - dragState.startPoint.x;
    const height = dragState.startHeight + point.y - dragState.startPoint.y;
    if (!dragState.preserveAspectRatio) return resizeWhiteboardElement(element, width, height);
    const useWidth = Math.abs(width - dragState.startWidth) >= Math.abs(height - dragState.startHeight);
    return resizeWhiteboardElement(element, useWidth ? width : height * dragState.aspectRatio, useWidth ? width / dragState.aspectRatio : height);
  }, []);

  const applyPendingElementResize = useCallback(() => {
    const pending = pendingElementResizeRef.current;
    pendingElementResizeRef.current = null;
    if (!pending) return;
    setElements((current) => current.map((element) => moveOrResizeElement(element, pending.state, pending.point)));
  }, [moveOrResizeElement, setElements]);

  const publishElementResize = useCallback(() => {
    elementResizeFrameRef.current = null;
    applyPendingElementResize();
  }, [applyPendingElementResize]);

  const scheduleElementResize = useCallback((state: WhiteboardDragState, point: WhiteboardPoint) => {
    pendingElementResizeRef.current = { point, state };
    if (elementResizeFrameRef.current === null) elementResizeFrameRef.current = window.requestAnimationFrame(publishElementResize);
  }, [publishElementResize]);

  const handleSelectionResizePointerDown = useCallback((event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => {
    event.stopPropagation();
    if (tool !== 'select' || event.button !== 0) return;
    const bounds = getSelectionBounds(elements, strokes, selectedElementIds, selectedStrokeIds);
    if (!bounds) return;
    const point = getBoardPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistory();
    const originalElements = elements.filter((item) => selectedElementIds.includes(item.id));
    const originalStrokes = strokes.filter((stroke) => selectedStrokeIds.includes(stroke.id));
    setDragState({
      bounds,
      handle,
      kind: 'resize-selection',
      originalElementsById: new Map(originalElements.map((item) => [item.id, item])),
      originalStrokesById: new Map(originalStrokes.map((stroke) => [stroke.id, stroke])),
      preserveAspectRatio: event.shiftKey,
      startPoint: point,
    });
  }, [elements, getBoardPoint, pushHistory, selectedElementIds, selectedStrokeIds, setDragState, strokes, tool]);

  const applyPendingSelectionResize = useCallback(() => {
    const pending = pendingSelectionResizeRef.current;
    pendingSelectionResizeRef.current = null;
    if (!pending) return;
    const { point, state } = pending;
    const nextBounds = getResizedSelectionBounds(state.bounds, state.startPoint, point, state.handle, state.preserveAspectRatio);
    setElements((current) => resizeSelectionElements(current, state.originalElementsById, state.bounds, nextBounds));
    setStrokes((current) => resizeSelectionStrokes(current, state.originalStrokesById, state.bounds, nextBounds));
  }, [setElements, setStrokes]);

  const publishSelectionResize = useCallback(() => {
    selectionResizeFrameRef.current = null;
    applyPendingSelectionResize();
  }, [applyPendingSelectionResize]);

  const scheduleSelectionResize = useCallback((state: Extract<WhiteboardDragState, { kind: 'resize-selection' }>, point: WhiteboardPoint) => {
    pendingSelectionResizeRef.current = { point, state };
    if (selectionResizeFrameRef.current === null) selectionResizeFrameRef.current = window.requestAnimationFrame(publishSelectionResize);
  }, [publishSelectionResize]);

  const flushResizeDrags = useCallback(() => {
    if (elementResizeFrameRef.current !== null) window.cancelAnimationFrame(elementResizeFrameRef.current);
    elementResizeFrameRef.current = null;
    applyPendingElementResize();
    if (selectionResizeFrameRef.current !== null) window.cancelAnimationFrame(selectionResizeFrameRef.current);
    selectionResizeFrameRef.current = null;
    applyPendingSelectionResize();
  }, [applyPendingElementResize, applyPendingSelectionResize]);

  useEffect(() => () => {
    if (elementResizeFrameRef.current !== null) window.cancelAnimationFrame(elementResizeFrameRef.current);
    if (selectionResizeFrameRef.current !== null) window.cancelAnimationFrame(selectionResizeFrameRef.current);
  }, []);

  return {
    beginElementTextEdit,
    endElementTextEdit,
    flushResizeDrags,
    handleElementPointerDown,
    handleResizePointerDown,
    handleSelectionResizePointerDown,
    moveOrResizeElement,
    resizeSelection: scheduleSelectionResize,
    scheduleElementResize,
    selectElement,
    setElementText,
  };
}

function getNextElementSelection(selectedIds: string[], id: string, additive: boolean): string[] {
  if (!additive) return selectedIds.includes(id) ? selectedIds : [id];
  return selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id];
}
