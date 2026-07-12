import { useCallback, useMemo, useRef, useState, type Dispatch, type MouseEvent, type PointerEvent, type SetStateAction } from 'react';
import { useWhiteboardBoardActions } from './useWhiteboardBoardActions';
import { useWhiteboardBrushCursor } from './useWhiteboardBrushCursor';
import { useWhiteboardBrushSizes } from './useWhiteboardBrushSizes';
import { useWhiteboardClipboard } from './useWhiteboardClipboard';
import { useWhiteboardConnectorCreation } from './useWhiteboardConnectorCreation';
import { useWhiteboardCoordinates } from './useWhiteboardCoordinates';
import { useWhiteboardDraftStroke } from './useWhiteboardDraftStroke';
import { useWhiteboardElementControls } from './useWhiteboardElementControls';
import { useWhiteboardElementCreation } from './useWhiteboardElementCreation';
import { useWhiteboardEraserScheduler } from './useWhiteboardEraserScheduler';
import { useWhiteboardEscapeKey } from './useWhiteboardEscapeKey';
import { useWhiteboardExport } from './useWhiteboardExport';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import { useWhiteboardImageImport } from './useWhiteboardImageImport';
import { useWhiteboardKeyboardShortcuts } from './useWhiteboardKeyboardShortcuts';
import { useWhiteboardPersistence } from './useWhiteboardPersistence';
import { useWhiteboardPointerActions } from './useWhiteboardPointerActions';
import { useWhiteboardPointerFinish } from './useWhiteboardPointerFinish';
import { useWhiteboardReady } from './useWhiteboardReady';
import { useWhiteboardRuler } from './useWhiteboardRuler';
import { useWhiteboardSelectionDeletion } from './useWhiteboardSelectionDeletion';
import { useWhiteboardSpacePan } from './useWhiteboardSpacePan';
import { useWhiteboardStrokeSelection } from './useWhiteboardStrokeSelection';
import { useWhiteboardStorageBridge } from './useWhiteboardStorageBridge';
import { useWhiteboardTouchPointers } from './useWhiteboardTouchPointers';
import { useWhiteboardViewportScheduler } from './useWhiteboardViewportScheduler';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';
import type { WhiteboardDragState } from '../model/whiteboardInteractions';
import {
  WHITEBOARD_DEFAULT_PAPER_STYLE, WHITEBOARD_INITIAL_VIEWPORT, WHITEBOARD_SEED_CONNECTORS, WHITEBOARD_SEED_ELEMENTS, WHITEBOARD_SEED_STROKES,
  isBrushTool,
  screenPointToBoardPoint,
  type WhiteboardBrushTool, type WhiteboardConnector, type WhiteboardElement,
  type WhiteboardPaperStyle, type WhiteboardStroke, type WhiteboardTool,
} from '../model/whiteboardModel';

interface WhiteboardControllerOptions {
  active: boolean; onPrimaryContentReady?: () => void; onStartupReady?: () => void;
}

export function useWhiteboardController({
  active,
  onPrimaryContentReady,
  onStartupReady,
}: WhiteboardControllerOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeBoardId = useWhiteboardStore((state) => state.activeBoardId);
  const appliedBoardIdRef = useRef<string | null>(null);
  const activePenPointerRef = useRef<number | null>(null);
  const strokeIdRef = useRef(getNextWhiteboardIdSequence(WHITEBOARD_SEED_STROKES, 'wb-stroke-'));
  const elementIdRef = useRef(getNextWhiteboardIdSequence(WHITEBOARD_SEED_ELEMENTS, 'wb-element-'));
  const connectorIdRef = useRef(getNextWhiteboardIdSequence(WHITEBOARD_SEED_CONNECTORS, 'wb-connector-'));
  const { brushColors, brushSizes, resizeBrush, setBrushColor } = useWhiteboardBrushSizes();
  const { appendDraftPoints, clearDraftStroke, draftStroke, getDraftStroke, setDraftStroke } = useWhiteboardDraftStroke();
  const { spacePressed, spacePressedRef } = useWhiteboardSpacePan(active);
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [viewport, setViewport] = useState(WHITEBOARD_INITIAL_VIEWPORT);
  const [elements, setElements] = useState<WhiteboardElement[]>(WHITEBOARD_SEED_ELEMENTS);
  const [connectors, setConnectors] = useState<WhiteboardConnector[]>(WHITEBOARD_SEED_CONNECTORS);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(WHITEBOARD_SEED_STROKES);
  const [paperStyle, setPaperStyle] = useState<WhiteboardPaperStyle>(WHITEBOARD_DEFAULT_PAPER_STYLE);
  const scheduleViewport = useWhiteboardViewportScheduler(setViewport);
  const { flushEraserPoints, scheduleEraserPoints } = useWhiteboardEraserScheduler(setStrokes);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const setSelectedElementId = useCallback<Dispatch<SetStateAction<string | null>>>((value) => setSelectedElementIds((current) => { const id = typeof value === 'function' ? value(current[0] ?? null) : value; return id ? [id] : []; }), []);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<WhiteboardDragState | null>(null);
  const { brushCursorPoint, setBrushCursorPoint } = useWhiteboardBrushCursor();
  const { canRedo, canUndo, pushHistory, redo, undo } = useWhiteboardHistory({ active, connectors, elements, historyKey: activeBoardId, paper: paperStyle, setConnectors, setElements, setPaper: setPaperStyle, setStrokes, strokes });
  const { beginRulerStroke, finishRulerDrag, finishRulerStroke, hideRuler, ruler, setRuler, showRulerAt, snapStrokePointsToRuler, startRulerDrag, updateRulerDrag } = useWhiteboardRuler();
  useWhiteboardStorageBridge({
    active, appliedBoardIdRef, connectorIdRef, elementIdRef, setConnectorSourceId, setConnectors,
    setElements, setPaper: setPaperStyle, setRuler, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setViewport, strokeIdRef,
  });
  useWhiteboardReady(onStartupReady, onPrimaryContentReady);
  const persistenceStatus = useWhiteboardPersistence({ connectors, elements, paper: paperStyle, ruler, strokes, viewport }, dragState !== null);
  useWhiteboardSelectionDeletion({
    active, pushHistory, selectedConnectorIds, selectedElementIds, selectedStrokeIds, setConnectors, setElements, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
  });
  useWhiteboardEscapeKey({ active, clearDraftStroke, setConnectorSourceId, setDragState, setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, setTool });
  const { getBoardPoint, getBoardPointFromRect, getViewportPoint } = useWhiteboardCoordinates(viewport, viewportRef);
  const { deletePointer, getPinchMetrics, setPointer } = useWhiteboardTouchPointers(getViewportPoint);
  const { beginElementTextEdit, endElementTextEdit, flushResizeDrags, handleElementPointerDown, handleResizePointerDown, handleSelectionResizePointerDown, moveOrResizeElement, resizeSelection, scheduleElementResize, selectElement, setElementText } = useWhiteboardElementControls({
    elements, getBoardPoint, pushHistory, selectedElementIds, selectedStrokeIds, setDragState, setElements, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes, strokes, tool,
  });
  const { commitCreatedElement, createElementAt, createTextNote, selectedNoteColor, setSelectedNoteColor } = useWhiteboardElementCreation({
    elementIdRef, elements, pushHistory, selectedElementIds, setElements, setSelectedConnectorIds, setSelectedElementId,
    setSelectedStrokeIds, setTool, tool, viewport, viewportRef,
  });
  const handlePaperStyleChange = useCallback((nextPaperStyle: WhiteboardPaperStyle) => {
    if (nextPaperStyle === paperStyle) return;
    pushHistory();
    setPaperStyle(nextPaperStyle);
  }, [paperStyle, pushHistory]);
  const handleSurfaceDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (tool !== 'select') return;
    if (event.target instanceof Element && event.target.closest('[data-whiteboard-element="true"]')) return;
    createElementAt('note', getBoardPoint(event.clientX, event.clientY));
  }, [createElementAt, getBoardPoint, tool]);
  const boardActionOptions = useMemo(() => ({
    clearDraftStroke, connectors, elements, getViewportPoint, pushHistory, redo, resizeBrush,
    scheduleViewport, setConnectors, setConnectorSourceId, setDragState, setDraftStroke, setElements,
    setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, setStrokes, setViewport, spacePressedRef, strokes, tool, undo, viewportRef,
  }), [
    clearDraftStroke, connectors, elements, getViewportPoint, pushHistory, redo, resizeBrush,
    scheduleViewport, setConnectors, setConnectorSourceId, setDragState, setDraftStroke, setElements,
    setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, setStrokes, setViewport, spacePressedRef, strokes, tool, undo,
    viewportRef,
  ]);
  const boardActions = useWhiteboardBoardActions(boardActionOptions);
  const { copyBoardToClipboard, exportBoard } = useWhiteboardExport({ connectors, elements, paper: paperStyle, strokes, viewportRef });
  const importImage = useWhiteboardImageImport({ pushHistory, setElements, setSelectedElementId, setSelectedStrokeIds, setTool, viewport, viewportRef });
  const clipboard = useWhiteboardClipboard({
    active, connectors, createTextNote, elements, importImage, pushHistory, selectedElementIds, selectedStrokeIds,
    setConnectors, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setTool, strokes,
  });
  const startStrokeSelection = useWhiteboardStrokeSelection({ pushHistory, selectedStrokeIds, setDragState, setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, strokes, zoom: viewport.zoom });
  const handleToolChange = useCallback((nextTool: WhiteboardTool) => {
    if (nextTool !== 'ruler') { setTool(nextTool); return; }
    if (ruler.visible) { hideRuler(); setTool('select'); return; }
    setTool('ruler');
    const rect = viewportRef.current?.getBoundingClientRect();
    showRulerAt(screenPointToBoardPoint({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }, viewport));
  }, [hideRuler, ruler.visible, showRulerAt, viewport]);
  useWhiteboardKeyboardShortcuts({ active, connectors, elements, pushHistory, resizeBrush, selectedBrushTool: isBrushTool(tool) ? tool : null, selectedConnectorIds, selectedElementIds, selectedStrokeIds, setElements, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setTool: handleToolChange, strokes, viewportZoom: viewport.zoom });
  const handleRulerPointerDown = useCallback((event: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: 'move' | 'rotate') => {
    startRulerDrag(event, getBoardPoint(event.clientX, event.clientY), mode);
  }, [getBoardPoint, startRulerDrag]);
  const handleConnectorTarget = useWhiteboardConnectorCreation({
    connectorIdRef, connectorSourceId, connectors, pushHistory, setConnectorSourceId,
    setConnectors, setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds,
  });
  const pointerActions = useWhiteboardPointerActions({
    activePenPointerRef, appendDraftPoints, beginRulerStroke, brushColors, brushSizes, clearDraftStroke,
    dragState, getBoardPointFromRect, getPinchMetrics, pushHistory, resizeSelection,
    scheduleElementResize, scheduleEraserPoints, scheduleViewport, setBrushCursorPoint,
    setConnectorSourceId, setDragState, setDraftStroke, setPointer, setSelectedConnectorIds, setSelectedElementId,
    setSelectedStrokeIds, showRulerAt, snapStrokePointsToRuler, spacePressedRef,
    startStrokeSelection, strokeIdRef, tool, updateRulerDrag, viewport, viewportRef,
  });
  const finishPointerAction = useWhiteboardPointerFinish({
    activePenPointerRef, clearDraftStroke, commitCreatedElement, deletePointer, dragState,
    elementIdRef, elements, finishRulerDrag, finishRulerStroke, flushEraserPoints,
    flushResizeDrags, getBoardPoint, getDraftStroke, moveOrResizeElement, pushHistory,
    setDragState, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
    strokeIdRef, strokes,
  });
  const selectConnector = useCallback((id: string, additive: boolean) => {
    setSelectedConnectorIds((current) => {
      if (!additive) return [id];
      return current.includes(id) ? current.filter((connectorId) => connectorId !== id) : [...current, id];
    });
    setSelectedElementIds([]);
    setSelectedStrokeIds([]);
  }, []);
  return {
    brushCursorColor: isBrushTool(tool) && tool !== 'eraser' ? brushColors[tool] : 'transparent',
    brushCursorPoint,
    brushCursorSize: isBrushTool(tool) ? brushSizes[tool] : 1,
    brushCursorTool: isBrushTool(tool) ? tool : null as WhiteboardBrushTool | null,
    brushColors, brushSizes, canRedo, canUndo,
    clearBoard: boardActions.clearBoard,
    connectorSourceId, connectors, draftElement: pointerActions.draftElement, draftStroke, elements,
    copyBoardToClipboard, exportBoard, handleConnectorTarget, handleElementPointerDown, handlePointerMove: pointerActions.handlePointerMove, handleSurfaceDoubleClick, importImage,
    handleRedo: boardActions.handleRedo,
    handleResizePointerDown, handleRulerClose: hideRuler, handleRulerPointerDown, handleSelectionResizePointerDown, handleUndo: boardActions.handleUndo, handleViewportPointerDown: pointerActions.handleViewportPointerDown, handleWheel: boardActions.handleWheel,
    fitView: boardActions.fitView,
    isPanning: pointerActions.isPanning,
    onCopy: clipboard.copySelection,
    onDuplicate: clipboard.duplicateSelection, onPaste: clipboard.pasteSelection, resetView: boardActions.resetView,
    paperStyle, persistenceStatus,
    movePreview: pointerActions.movePreview,
    ruler,
    selectedConnectorIds, selectedElementIds, selectedNoteColor, selectedStrokeIds, selectConnector,
    selectionRect: pointerActions.selectionRect,
    selectionPath: pointerActions.selectionPath,
    beginElementTextEdit, endElementTextEdit, resizeBrush, setBrushColor, setBrushCursorPoint, setElementText,
    setPaperStyle: handlePaperStyleChange, setSelectedElementId: selectElement, setSelectedNoteColor,
    setTool: handleToolChange, spacePressed, strokes, tool,
    updateZoom: boardActions.updateZoom, viewport, viewportRef, finishPointerAction,
  };
}
