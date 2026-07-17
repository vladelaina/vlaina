import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  type WheelEvent,
} from 'react';
import { themeGraphTokens } from '@/styles/themeTokens';
import {
  fitGraphViewportToNodes,
  GRAPH_INITIAL_VIEWPORT,
  zoomGraphViewportAtPoint,
  type GraphPoint,
  type GraphViewport,
} from '../model/graphViewport';
import type { PositionedGraphNode } from '../model/graphLayout';

const WHEEL_ZOOM_INTENSITY = 0.0015;

export function useGraphViewportController(args: {
  nodeKey: string;
  nodes: PositionedGraphNode[];
  selectedPath: string | null;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const nodesRef = useRef(args.nodes);
  const [viewport, setViewport] = useState(GRAPH_INITIAL_VIEWPORT);
  const viewportRef = useRef(viewport);
  const pendingWheelViewportRef = useRef<typeof viewport | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const viewportAnimationFrameRef = useRef<number | null>(null);
  nodesRef.current = args.nodes;
  viewportRef.current = viewport;

  const cancelWheelFrame = useCallback(() => {
    if (wheelFrameRef.current !== null) window.cancelAnimationFrame(wheelFrameRef.current);
    wheelFrameRef.current = null;
    pendingWheelViewportRef.current = null;
  }, []);

  const cancelViewportAnimation = useCallback(() => {
    if (viewportAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(viewportAnimationFrameRef.current);
    }
    viewportAnimationFrameRef.current = null;
  }, []);

  const setViewportImmediately = useCallback<Dispatch<SetStateAction<GraphViewport>>>((value) => {
    cancelViewportAnimation();
    setViewport((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      viewportRef.current = next;
      return next;
    });
  }, [cancelViewportAnimation]);

  const animateViewportTo = useCallback((target: GraphViewport) => {
    cancelWheelFrame();
    cancelViewportAnimation();
    const start = viewportRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reducedMotion || (
      start.x === target.x && start.y === target.y && start.zoom === target.zoom
    )) {
      setViewportImmediately(target);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0,
        (now - startedAt) / themeGraphTokens.viewportAnimationDurationMs));
      const eased = 1 - (1 - progress) ** 3;
      const next = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
      };
      viewportRef.current = next;
      setViewport(next);
      if (progress < 1) {
        viewportAnimationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        viewportAnimationFrameRef.current = null;
      }
    };
    viewportAnimationFrameRef.current = window.requestAnimationFrame(step);
  }, [cancelViewportAnimation, cancelWheelFrame, setViewportImmediately]);

  const getFittedViewport = useCallback((nextNodes: readonly GraphPoint[] = nodesRef.current) => {
    const rect = args.svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fitGraphViewportToNodes(nextNodes, { x: rect.width, y: rect.height });
  }, [args.svgRef]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const next = getFittedViewport();
      if (next) setViewportImmediately(next);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [args.nodeKey, getFittedViewport, setViewportImmediately]);

  useEffect(() => () => {
    cancelWheelFrame();
    cancelViewportAnimation();
  }, [cancelViewportAnimation, cancelWheelFrame]);

  useEffect(() => {
    if (!args.selectedPath) return;
    const node = nodesRef.current.find((item) => item.id === args.selectedPath);
    const rect = args.svgRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    const current = viewportRef.current;
    const screenX = current.x + node.x * current.zoom;
    const screenY = current.y + node.y * current.zoom;
    const inset = themeGraphTokens.fitViewPaddingPx;
    if (
      screenX >= inset
      && screenX <= rect.width - inset
      && screenY >= inset
      && screenY <= rect.height - inset
    ) return;
    animateViewportTo({
      ...current,
      x: rect.width / 2 - node.x * current.zoom,
      y: rect.height / 2 - node.y * current.zoom,
    });
  }, [animateViewportTo, args.nodeKey, args.selectedPath, args.svgRef]);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    cancelViewportAnimation();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const current = pendingWheelViewportRef.current ?? viewportRef.current;
    const next = zoomGraphViewportAtPoint(
      current,
      point,
      current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_INTENSITY),
    );
    pendingWheelViewportRef.current = next;
    viewportRef.current = next;
    if (wheelFrameRef.current !== null) return;
    wheelFrameRef.current = window.requestAnimationFrame(() => {
      wheelFrameRef.current = null;
      const pendingViewport = pendingWheelViewportRef.current;
      pendingWheelViewportRef.current = null;
      if (pendingViewport) setViewport(pendingViewport);
    });
  };

  return { handleWheel, setViewport: setViewportImmediately, viewport };
}
