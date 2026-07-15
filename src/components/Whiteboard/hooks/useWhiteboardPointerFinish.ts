import { useCallback, type Dispatch, type MutableRefObject, type PointerEvent, type SetStateAction } from 'react';
import { isWhiteboardMoveDragState, type WhiteboardDragState } from '../model/whiteboardInteractions';
import type { WhiteboardElement, WhiteboardPoint, WhiteboardStroke } from '../model/whiteboardModel';
import { getItemsInLasso, translateStrokesFromOriginals } from '../model/whiteboardSelection';

interface WhiteboardPointerFinishOptions {
  activePenPointerRef: MutableRefObject<number | null>;
  clearDraftStroke: () => void;
  deletePointer: (pointerId: number) => void;
  dragState: WhiteboardDragState | null;
  elements: WhiteboardElement[];
  finishRulerDrag: () => void;
  finishRulerStroke: () => void;
  finishEraserGesture: (cancelled?: boolean) => void;
  finishStrokeEraserGesture: (cancelled?: boolean) => void;
  flushResizeDrags: () => void;
  getBoardPoint: (clientX: number, clientY: number) => WhiteboardPoint;
  getDraftStroke: () => WhiteboardStroke | null;
  moveOrResizeElement: (element: WhiteboardElement, dragState: WhiteboardDragState, point: WhiteboardPoint) => WhiteboardElement;
  pushHistory: () => void;
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  strokeIdRef: MutableRefObject<number>;
  strokes: WhiteboardStroke[];
}

export function useWhiteboardPointerFinish({
  activePenPointerRef,
  clearDraftStroke,
  deletePointer,
  dragState,
  elements,
  finishRulerDrag,
  finishRulerStroke,
  finishEraserGesture,
  finishStrokeEraserGesture,
  flushResizeDrags,
  getBoardPoint,
  getDraftStroke,
  moveOrResizeElement,
  pushHistory,
  setDragState,
  setElements,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  strokeIdRef,
  strokes,
}: WhiteboardPointerFinishOptions) {
  return useCallback((event?: PointerEvent<HTMLDivElement>) => {
    if (event) deletePointer(event.pointerId);
    finishRulerDrag();
    finishRulerStroke();
    finishEraserGesture(event?.type === 'pointercancel');
    finishStrokeEraserGesture(event?.type === 'pointercancel');
    flushResizeDrags();
    if (event?.pointerId === activePenPointerRef.current) activePenPointerRef.current = null;
    const currentDraft = getDraftStroke();
    if (dragState?.kind === 'draw' && currentDraft && currentDraft.points.length > 0) {
      pushHistory();
      setStrokes((current) => [...current, { ...currentDraft, id: `wb-stroke-${strokeIdRef.current}` }]);
      strokeIdRef.current += 1;
    }
    if (dragState?.kind === 'lasso') {
      const selection = getItemsInLasso(elements, strokes, dragState.points);
      setSelectedElementIds(selection.elementIds);
      setSelectedStrokeIds(selection.strokeIds);
    }
    if (isWhiteboardMoveDragState(dragState)) {
      const point = event ? getBoardPoint(event.clientX, event.clientY) : dragState.currentPoint;
      const dx = point.x - dragState.startPoint.x;
      const dy = point.y - dragState.startPoint.y;
      if (dragState.kind === 'move-strokes' || dragState.originalStrokesById.size > 0) {
        setStrokes((current) => translateStrokesFromOriginals(current, dragState.originalStrokesById, dx, dy));
      }
      if (dragState.kind === 'move-elements') {
        setElements((current) => current.map((element) => moveOrResizeElement(element, dragState, point)));
      }
    }
    clearDraftStroke();
    setDragState(null);
  }, [
    activePenPointerRef, clearDraftStroke, deletePointer, dragState,
    elements, finishEraserGesture, finishRulerDrag, finishRulerStroke, finishStrokeEraserGesture, flushResizeDrags, getBoardPoint,
    getDraftStroke, moveOrResizeElement, pushHistory, setDragState, setElements, setSelectedElementIds,
    setSelectedStrokeIds, setStrokes, strokeIdRef, strokes,
  ]);
}
