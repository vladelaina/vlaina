import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { isWhiteboardMoveDragState, type WhiteboardDragState } from '../model/whiteboardInteractions';
import type { WhiteboardPoint } from '../model/whiteboardModel';

export function useWhiteboardMoveDragScheduler(
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>,
) {
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<WhiteboardPoint | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    const point = pendingPointRef.current;
    pendingPointRef.current = null;
    if (!point) return;
    setDragState((current) => (isWhiteboardMoveDragState(current) ? { ...current, currentPoint: point } : current));
  }, [setDragState]);

  const scheduleMoveDragPoint = useCallback((point: WhiteboardPoint) => {
    pendingPointRef.current = point;
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(flush);
  }, [flush]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  return scheduleMoveDragPoint;
}
