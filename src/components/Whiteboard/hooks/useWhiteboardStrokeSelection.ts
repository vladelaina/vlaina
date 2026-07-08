import { useCallback, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import type { WhiteboardDragState } from '../model/whiteboardInteractions';
import type { WhiteboardPoint, WhiteboardStroke } from '../model/whiteboardModel';
import { findStrokeAtPoint } from '../model/whiteboardSelection';

interface WhiteboardStrokeSelectionOptions {
  pushHistory: () => void;
  selectedStrokeIds: string[];
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  strokes: WhiteboardStroke[];
  zoom: number;
}

export function useWhiteboardStrokeSelection({
  pushHistory,
  selectedStrokeIds,
  setDragState,
  setSelectedElementId,
  setSelectedStrokeIds,
  strokes,
  zoom,
}: WhiteboardStrokeSelectionOptions) {
  return useCallback((point: WhiteboardPoint, event: PointerEvent<HTMLDivElement>) => {
    const hitStroke = findStrokeAtPoint(strokes, point, zoom);
    setSelectedElementId(null);
    if (!hitStroke) {
      setSelectedStrokeIds([]);
      setDragState({ kind: 'marquee', currentPoint: point, startPoint: point });
      return;
    }
    const hitSelected = selectedStrokeIds.includes(hitStroke.id);
    const nextIds = hitSelected && event.shiftKey
      ? selectedStrokeIds.filter((id) => id !== hitStroke.id)
      : Array.from(new Set(event.shiftKey || hitSelected ? [...selectedStrokeIds, hitStroke.id] : [hitStroke.id]));
    setSelectedStrokeIds(nextIds);
    if (nextIds.length === 0) return;
    pushHistory();
    const originalStrokes = strokes.filter((stroke) => nextIds.includes(stroke.id));
    setDragState({
      kind: 'move-strokes',
      currentPoint: point,
      originalStrokesById: new Map(originalStrokes.map((stroke) => [stroke.id, stroke])),
      startPoint: point,
      strokeIds: nextIds,
    });
  }, [pushHistory, selectedStrokeIds, setDragState, setSelectedElementId, setSelectedStrokeIds, strokes, zoom]);
}
