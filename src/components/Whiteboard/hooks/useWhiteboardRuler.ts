import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardPoint, WhiteboardStrokePoint } from '../model/whiteboardModel';

export interface WhiteboardRulerState {
  angle: number;
  visible: boolean;
  x: number;
  y: number;
}

type RulerDragState =
  | { kind: 'move'; offsetX: number; offsetY: number }
  | { kind: 'rotate'; startAngle: number; startPointerAngle: number };
type RulerUpdate = (current: WhiteboardRulerState) => WhiteboardRulerState;
interface RulerBoardSize { height: number; width: number; zoom: number }
type RulerSnapEdge = 'top' | 'bottom';
interface RulerSnapResult { blocked: boolean; breakBefore?: boolean; edge: RulerSnapEdge | null; point: WhiteboardPoint }
interface RulerSnapOptions { hasPreviousPoint?: boolean }

const DEFAULT_RULER: WhiteboardRulerState = {
  angle: -8,
  visible: false,
  x: 360,
  y: 240,
};

export function useWhiteboardRuler(initialRuler?: Partial<WhiteboardRulerState>) {
  const [ruler, setRuler] = useState<WhiteboardRulerState>({ ...DEFAULT_RULER, ...initialRuler });
  const dragRef = useRef<RulerDragState | null>(null);
  const snapEdgeRef = useRef<RulerSnapEdge | null>(null);
  const hasStrokePointRef = useRef(false);
  const nextPointBreakRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingRulerUpdateRef = useRef<RulerUpdate | null>(null);

  const flushRulerUpdate = useCallback(() => {
    frameRef.current = null;
    const update = pendingRulerUpdateRef.current;
    pendingRulerUpdateRef.current = null;
    if (update) setRuler(update);
  }, []);

  const scheduleRulerUpdate = useCallback((update: RulerUpdate) => {
    pendingRulerUpdateRef.current = update;
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(flushRulerUpdate);
  }, [flushRulerUpdate]);

  const cancelPendingRulerUpdate = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRulerUpdateRef.current = null;
  }, []);

  const showRulerAt = useCallback((point: WhiteboardPoint) => {
    cancelPendingRulerUpdate();
    setRuler((current) => ({ ...current, visible: true, x: point.x, y: point.y }));
  }, [cancelPendingRulerUpdate]);

  const hideRuler = useCallback(() => {
    cancelPendingRulerUpdate();
    dragRef.current = null;
    snapEdgeRef.current = null;
    hasStrokePointRef.current = false;
    nextPointBreakRef.current = false;
    setRuler((current) => ({ ...current, visible: false }));
  }, [cancelPendingRulerUpdate]);

  const beginRulerStroke = useCallback(() => {
    snapEdgeRef.current = null;
    hasStrokePointRef.current = false;
    nextPointBreakRef.current = false;
  }, []);

  const snapStrokePointsToRuler = useCallback((points: WhiteboardStrokePoint[], zoom: number) => {
    if (!ruler.visible) return points;
    const snappedPoints: WhiteboardStrokePoint[] = [];
    const size = getRulerBoardSize(zoom);
    for (const point of points) {
      const snap = snapPointToRuler(point, ruler, snapEdgeRef.current, size, {
        hasPreviousPoint: hasStrokePointRef.current || snappedPoints.length > 0,
      });
      if (snap.blocked) {
        nextPointBreakRef.current = hasStrokePointRef.current || snappedPoints.length > 0;
        continue;
      }
      snapEdgeRef.current = snap.edge;
      snappedPoints.push({ ...point, ...snap.point, breakBefore: snap.breakBefore || nextPointBreakRef.current || point.breakBefore });
      hasStrokePointRef.current = true;
      nextPointBreakRef.current = false;
    }
    return snappedPoints;
  }, [ruler]);

  const startRulerDrag = useCallback((event: PointerEvent, point: WhiteboardPoint, mode: 'move' | 'rotate') => {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (mode === 'move') {
      dragRef.current = { kind: 'move', offsetX: point.x - ruler.x, offsetY: point.y - ruler.y };
      return;
    }
    dragRef.current = {
      kind: 'rotate',
      startAngle: ruler.angle,
      startPointerAngle: getAngleBetween(ruler, point),
    };
  }, [ruler]);

  const updateRulerDrag = useCallback((point: WhiteboardPoint) => {
    const drag = dragRef.current;
    if (!drag) return false;
    if (drag.kind === 'move') {
      scheduleRulerUpdate((current) => ({ ...current, x: point.x - drag.offsetX, y: point.y - drag.offsetY }));
      return true;
    }
    scheduleRulerUpdate((current) => ({
      ...current,
      angle: drag.startAngle + getAngleBetween(current, point) - drag.startPointerAngle,
    }));
    return true;
  }, [scheduleRulerUpdate]);

  const finishRulerDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const finishRulerStroke = useCallback(() => {
    snapEdgeRef.current = null;
    hasStrokePointRef.current = false;
    nextPointBreakRef.current = false;
  }, []);

  useEffect(() => cancelPendingRulerUpdate, [cancelPendingRulerUpdate]);

  return {
    beginRulerStroke, finishRulerDrag, finishRulerStroke, hideRuler, ruler, setRuler,
    showRulerAt, snapStrokePointsToRuler, startRulerDrag, updateRulerDrag,
  };
}

export function snapPointToRuler(
  point: WhiteboardPoint,
  ruler: WhiteboardRulerState,
  lockedEdge: RulerSnapEdge | null,
  size: RulerBoardSize,
  options: RulerSnapOptions = {},
): RulerSnapResult {
  const local = toRulerLocal(point, ruler, size);
  if (local.x < 0 || local.x > size.width) return getReleasedRulerPoint(point, lockedEdge);
  const topDistance = Math.abs(local.y);
  const bottomDistance = Math.abs(local.y - size.height);
  const nearestEdge: RulerSnapEdge = topDistance < bottomDistance ? 'top' : 'bottom';
  const edge = lockedEdge ?? nearestEdge;
  const edgeDistance = edge === 'top' ? topDistance : bottomDistance;
  const captureDistance = themeWhiteboardTokens.rulerCaptureDistancePx / Math.max(zoomFloor, size.zoom);
  const releaseDistance = themeWhiteboardTokens.rulerSnapDistancePx / Math.max(zoomFloor, size.zoom);
  const snapDistance = lockedEdge ? releaseDistance : captureDistance;
  const insideRulerBand = local.y >= -snapDistance && local.y <= size.height + snapDistance;
  if (!insideRulerBand || (!lockedEdge && edgeDistance > snapDistance && (local.y < 0 || local.y > size.height))) {
    return getReleasedRulerPoint(point, lockedEdge);
  }
  const y = edge === 'top' ? 0 : size.height;
  return {
    blocked: false,
    breakBefore: options.hasPreviousPoint && !lockedEdge,
    edge,
    point: fromRulerLocal({ x: local.x, y }, ruler, size),
  };
}

function getReleasedRulerPoint(point: WhiteboardPoint, lockedEdge: RulerSnapEdge | null): RulerSnapResult {
  return lockedEdge
    ? { blocked: false, breakBefore: true, edge: null, point }
    : { blocked: false, edge: null, point };
}

const zoomFloor = 0.01;

function getRulerBoardSize(zoom: number) {
  const safeZoom = Math.max(zoomFloor, zoom);
  return {
    height: themeWhiteboardTokens.rulerHeightPx / safeZoom,
    width: themeWhiteboardTokens.rulerWidthPx / safeZoom,
    zoom: safeZoom,
  };
}

function toRulerLocal(point: WhiteboardPoint, ruler: WhiteboardRulerState, size: RulerBoardSize): WhiteboardPoint {
  const angle = -ruler.angle * Math.PI / 180;
  const dx = point.x - ruler.x;
  const dy = point.y - ruler.y;
  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle) + size.width / 2,
    y: dx * Math.sin(angle) + dy * Math.cos(angle) + size.height / 2,
  };
}

function fromRulerLocal(point: WhiteboardPoint, ruler: WhiteboardRulerState, size: RulerBoardSize): WhiteboardPoint {
  const angle = ruler.angle * Math.PI / 180;
  const dx = point.x - size.width / 2;
  const dy = point.y - size.height / 2;
  return {
    x: ruler.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: ruler.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

function getAngleBetween(ruler: WhiteboardRulerState, point: WhiteboardPoint): number {
  return Math.atan2(point.y - ruler.y, point.x - ruler.x) * 180 / Math.PI;
}
