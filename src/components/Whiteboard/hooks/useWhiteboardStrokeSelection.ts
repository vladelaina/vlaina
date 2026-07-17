import { useCallback, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import type { WhiteboardDragState } from '../model/whiteboardInteractions';
import type { WhiteboardElement, WhiteboardPoint, WhiteboardStroke } from '../model/whiteboardModel';
import { findStrokeAtPoint } from '../model/whiteboardSelection';

interface WhiteboardStrokeSelectionOptions {
  elements: WhiteboardElement[];
  pushHistory: () => void;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  strokes: WhiteboardStroke[];
  zoom: number;
}

export function useWhiteboardStrokeSelection({
  elements,
  pushHistory,
  selectedElementIds,
  selectedStrokeIds,
  setDragState,
  setSelectedElementId,
  setSelectedStrokeIds,
  strokes,
  zoom,
}: WhiteboardStrokeSelectionOptions) {
  return useCallback((point: WhiteboardPoint, event: PointerEvent<HTMLDivElement>) => {
    const hitStroke = findStrokeAtPoint(strokes, point, zoom);
    if (!hitStroke) {
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      setDragState({ kind: 'lasso', points: [point] });
      return;
    }
    const hitSelected = selectedStrokeIds.includes(hitStroke.id);
    const nextIds = hitSelected && event.shiftKey
      ? selectedStrokeIds.filter((id) => id !== hitStroke.id)
      : Array.from(new Set(event.shiftKey || hitSelected ? [...selectedStrokeIds, hitStroke.id] : [hitStroke.id]));
    const keepElementSelection = event.shiftKey || hitSelected;
    if (!keepElementSelection) setSelectedElementId(null);
    setSelectedStrokeIds(nextIds);
    if (event.shiftKey || nextIds.length === 0) return;
    pushHistory();
    const originalStrokes = strokes.filter((stroke) => nextIds.includes(stroke.id));
    if (selectedElementIds.length > 0 && keepElementSelection) {
      const originalElements = elements.filter((element) => selectedElementIds.includes(element.id));
      setDragState({
        kind: 'move-elements',
        currentPoint: point,
        elementIds: selectedElementIds,
        originalElementsById: new Map(originalElements.map((element) => [element.id, element])),
        originalStrokesById: new Map(originalStrokes.map((stroke) => [stroke.id, stroke])),
        startPoint: point,
        strokeIds: nextIds,
      });
      return;
    }
    setDragState({
      kind: 'move-strokes',
      currentPoint: point,
      originalStrokesById: new Map(originalStrokes.map((stroke) => [stroke.id, stroke])),
      startPoint: point,
      strokeIds: nextIds,
    });
  }, [elements, pushHistory, selectedElementIds, selectedStrokeIds, setDragState, setSelectedElementId, setSelectedStrokeIds, strokes, zoom]);
}
