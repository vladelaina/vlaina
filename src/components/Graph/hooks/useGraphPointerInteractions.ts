import { useCallback, useEffect, useRef, type Dispatch, type PointerEvent, type RefObject, type SetStateAction } from 'react';
import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';
import type { GraphNodePosition } from '../store/useGraphUIStore';
import type { GraphViewport } from '../model/graphViewport';

type DragState =
  | { kind: 'pan'; moved: boolean; startClientX: number; startClientY: number; startViewport: GraphViewport }
  | { kind: 'node'; id: string; moved: boolean; startedAt: number; startClientX: number; startClientY: number; startPosition: GraphNodePosition };

const DRAG_THRESHOLD_PX = 4;

interface GraphPointerInteractionOptions {
  onDragPosition: (id: string, position: GraphNodePosition) => void;
  onOpenPath: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onReleaseDrag: (id: string) => void;
  onSelectPath: (path: string | null) => void;
  setDragPosition: Dispatch<SetStateAction<{ id: string; position: GraphNodePosition } | null>>;
  setViewport: Dispatch<SetStateAction<GraphViewport>>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewport: GraphViewport;
}

export function useGraphPointerInteractions(options: GraphPointerInteractionOptions) {
  const dragRef = useRef<DragState | null>(null);
  const viewportRef = useRef(options.viewport);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  viewportRef.current = options.viewport;

  const getMovement = (drag: DragState, clientX: number, clientY: number) => {
    const deltaX = clientX - drag.startClientX;
    const deltaY = clientY - drag.startClientY;
    return {
      deltaX,
      deltaY,
      moved: drag.moved || Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX,
    };
  };

  const getNodePosition = (
    drag: Extract<DragState, { kind: 'node' }>,
    deltaX: number,
    deltaY: number,
  ): GraphNodePosition => ({
    x: drag.startPosition.x + deltaX / viewportRef.current.zoom,
    y: drag.startPosition.y + deltaY / viewportRef.current.zoom,
  });

  const applyPointerPoint = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const movement = getMovement(drag, clientX, clientY);
    dragRef.current = { ...drag, moved: movement.moved };
    if (drag.kind === 'pan') {
      options.setViewport({
        ...drag.startViewport,
        x: drag.startViewport.x + movement.deltaX,
        y: drag.startViewport.y + movement.deltaY,
      });
      return;
    }
    options.onDragPosition(
      drag.id,
      getNodePosition(drag, movement.deltaX, movement.deltaY),
    );
  };

  const flushPendingPoint = () => {
    frameRef.current = null;
    const point = pendingPointRef.current;
    pendingPointRef.current = null;
    if (point) applyPointerPoint(point.x, point.y);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    pendingPointRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(flushPendingPoint);
    }
  };

  const finishDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingPointRef.current = null;
    const initialDrag = dragRef.current;
    if (!initialDrag) return;
    const movement = getMovement(initialDrag, event.clientX, event.clientY);
    const drag = { ...initialDrag, moved: movement.moved } as DragState;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.kind === 'node') {
      const finalPosition = getNodePosition(drag, movement.deltaX, movement.deltaY);
      logDiagnostic('graph', 'pointer-drag-release', {
        deltaX: movement.deltaX,
        deltaY: movement.deltaY,
        durationMs: Math.round(performance.now() - drag.startedAt),
        finalPosition,
        id: drag.id,
        moved: drag.moved,
      });
      if (drag.moved) {
        options.onDragPosition(drag.id, finalPosition);
        options.onReleaseDrag(drag.id);
        options.onPositionCommit(
          drag.id,
          finalPosition,
        );
      } else {
        options.onReleaseDrag(drag.id);
        options.onOpenPath(drag.id);
      }
      options.setDragPosition(null);
    } else if (drag.moved) {
      options.setViewport({
        ...drag.startViewport,
        x: drag.startViewport.x + movement.deltaX,
        y: drag.startViewport.y + movement.deltaY,
      });
    } else {
      options.onSelectPath(null);
    }
  };

  const startPan = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'pan',
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: viewportRef.current,
    };
  };

  const startNodeDrag = useCallback((
    event: PointerEvent<SVGGElement>,
    id: string,
    position: GraphNodePosition,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    options.svgRef.current?.setPointerCapture(event.pointerId);
    logDiagnostic('graph', 'pointer-drag-start', {
      clientX: event.clientX,
      clientY: event.clientY,
      id,
      position,
      zoom: viewportRef.current.zoom,
    });
    options.setDragPosition({ id, position });
    dragRef.current = {
      kind: 'node',
      id,
      moved: false,
      startedAt: performance.now(),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
    };
  }, [options.svgRef]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  return {
    finishDrag,
    handlePointerMove,
    startNodeDrag,
    startPan,
  };
}
