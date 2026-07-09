import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { eraseStrokesAtPoints, type WhiteboardEraserPoint } from '../model/whiteboardStrokeGeometry';
import type { WhiteboardStroke } from '../model/whiteboardModel';

export function useWhiteboardEraserScheduler(
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>,
) {
  const frameRef = useRef<number | null>(null);
  const pendingPointsRef = useRef<WhiteboardEraserPoint[]>([]);

  const applyPendingPoints = useCallback(() => {
    const points = pendingPointsRef.current;
    pendingPointsRef.current = [];
    if (points.length === 0) return;
    setStrokes((current) => eraseStrokesAtPoints(current, points));
  }, [setStrokes]);

  const flushEraserPoints = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    applyPendingPoints();
  }, [applyPendingPoints]);

  const publishEraserPoints = useCallback(() => {
    frameRef.current = null;
    applyPendingPoints();
  }, [applyPendingPoints]);

  const scheduleEraserPoints = useCallback((points: WhiteboardEraserPoint[]) => {
    pendingPointsRef.current.push(...points);
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(publishEraserPoints);
  }, [publishEraserPoints]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  return { flushEraserPoints, scheduleEraserPoints };
}
