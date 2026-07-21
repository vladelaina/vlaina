import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useI18n } from '@/lib/i18n';
import { themeGraphTokens } from '@/styles/themeTokens';
import { GraphCanvasScene } from './canvas/GraphCanvasScene';
import {
  applyDraggedGraphNodePosition,
  applyGraphPositions,
  clearGraphPositionElements,
} from './canvas/applyGraphPositions';
import { useGraphCanvasGeometry } from './hooks/useGraphCanvasGeometry';
import { useGraphForceSimulation } from './hooks/useGraphForceSimulation';
import { useGraphPointerInteractions } from './hooks/useGraphPointerInteractions';
import { useGraphViewportController } from './hooks/useGraphViewportController';
import type { PositionedNoteGraph } from './model/graphLayout';
import type { GraphNodePositions, GraphNodePosition } from './store/useGraphUIStore';

interface GraphCanvasProps {
  active?: boolean;
  graph: PositionedNoteGraph;
  positionOverrides: GraphNodePositions;
  selectedPath: string | null;
  onOpenPath: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onPositionsCommit: (positions: GraphNodePositions) => void;
  onSelectPath: (path: string | null) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphRef = useRef(props.graph);
  const forceFrameRef = useRef(0);
  const userPositionedViewportRef = useRef(false);
  const hoveredGraphRef = useRef(props.graph);
  const hoverClearTimeoutRef = useRef<number | null>(null);
  const suppressedHoverPathRef = useRef<string | null>(null);
  const suppressHoverUntilPointerMoveRef = useRef(false);
  if (graphRef.current !== props.graph) {
    clearGraphPositionElements(svgRef.current);
    graphRef.current = props.graph;
    forceFrameRef.current = 0;
    userPositionedViewportRef.current = false;
    suppressedHoverPathRef.current = null;
    suppressHoverUntilPointerMoveRef.current = false;
  }
  const [forceLayoutVersion, setForceLayoutVersion] = useState(0);
  const [labelsReadyGraph, setLabelsReadyGraph] = useState<PositionedNoteGraph | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    id: string;
    position: GraphNodePosition;
  } | null>(null);
  const dragPositionRef = useRef<typeof dragPosition>(null);
  dragPositionRef.current = dragPosition;
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const visibleHoveredPath = hoveredGraphRef.current === props.graph ? hoveredPath : null;
  const handlePositionsFrame = useCallback((positions: GraphNodePositions) => {
    const updateAllEdges = forceFrameRef.current
      % themeGraphTokens.edgeAnimationFrameInterval === 0;
    const edgeUpdateMode = dragPositionRef.current
      ? 'active'
      : updateAllEdges ? 'all' : 'none';
    forceFrameRef.current += 1;
    applyGraphPositions(svgRef.current, positions, edgeUpdateMode);
  }, []);
  const handlePositionsInitialized = useCallback(() => {
    setLabelsReadyGraph(graphRef.current);
    if (userPositionedViewportRef.current) return;
    setForceLayoutVersion((current) => current + 1);
  }, []);
  const forceSimulation = useGraphForceSimulation({
    active: props.active !== false,
    dragPosition,
    graph: props.graph,
    onDraggedPositionFrame: (id, position) => {
      applyDraggedGraphNodePosition(svgRef.current, id, position);
    },
    onPositionsCommit: props.onPositionsCommit,
    onPositionsFrame: handlePositionsFrame,
    onPositionsInitialized: handlePositionsInitialized,
    positionOverrides: props.positionOverrides,
  });
  const handlePositionCommit = useCallback((path: string, position: GraphNodePosition) => {
    applyGraphPositions(svgRef.current, forceSimulation.positionsRef.current);
    props.onPositionCommit(path, position);
  }, [forceSimulation.positionsRef, props.onPositionCommit]);
  const geometry = useGraphCanvasGeometry({
    dragPosition,
    graph: props.graph,
    positionOverrides: props.positionOverrides,
    selectedPath: props.selectedPath,
    simulationPositions: forceSimulation.positionsRef.current,
    simulationVersion: forceFrameRef.current,
  });
  const viewportController = useGraphViewportController({
    nodeKey: `${geometry.nodeKey}\n${forceLayoutVersion}\n${props.active === false ? 'inactive' : 'active'}`,
    nodes: geometry.nodes,
    selectedPath: props.selectedPath,
    svgRef,
  });
  const pointerInteractions = useGraphPointerInteractions({
    onDragPosition: forceSimulation.updateDragPosition,
    onOpenPath: props.onOpenPath,
    onPositionCommit: handlePositionCommit,
    onReleaseDrag: forceSimulation.releaseDragPosition,
    onSelectPath: props.onSelectPath,
    setDragPosition,
    setViewport: viewportController.setViewport,
    svgRef,
    viewport: viewportController.viewport,
  });
  const startNodeDrag = useCallback((
    event: ReactPointerEvent<SVGGElement>,
    path: string,
    position: GraphNodePosition,
  ) => {
    userPositionedViewportRef.current = true;
    viewportController.cancelPendingFit();
    pointerInteractions.startNodeDrag(event, path, position);
  }, [pointerInteractions.startNodeDrag, viewportController.cancelPendingFit]);
  const startPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 0 || event.button === 1) {
      userPositionedViewportRef.current = true;
      viewportController.cancelPendingFit();
    }
    pointerInteractions.startPan(event);
  }, [pointerInteractions.startPan, viewportController.cancelPendingFit]);
  const handleWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    userPositionedViewportRef.current = true;
    viewportController.cancelPendingFit();
    viewportController.handleWheel(event);
  }, [viewportController.cancelPendingFit, viewportController.handleWheel]);
  const handleHoverChange = useCallback((path: string | null) => {
    if (suppressHoverUntilPointerMoveRef.current && path) return;
    if (hoverClearTimeoutRef.current !== null) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
    if (path) {
      if (suppressedHoverPathRef.current === path) return;
      hoveredGraphRef.current = graphRef.current;
      setHoveredPath((current) => current === path ? current : path);
      return;
    }
    hoverClearTimeoutRef.current = window.setTimeout(() => {
      hoverClearTimeoutRef.current = null;
      setHoveredPath(null);
    }, themeGraphTokens.nodeHoverLeaveDelayMs);
  }, []);
  const handleFocusChange = useCallback((path: string) => {
    suppressHoverUntilPointerMoveRef.current = false;
    suppressedHoverPathRef.current = null;
    handleHoverChange(path);
  }, [handleHoverChange]);
  const clearPointerHover = useCallback((draggedNodeId: string | null) => {
    suppressHoverUntilPointerMoveRef.current = true;
    suppressedHoverPathRef.current = draggedNodeId;
    if (hoverClearTimeoutRef.current !== null) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
    setHoveredPath(null);
  }, []);
  const finishPointerInteraction = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const draggedNodeId = pointerInteractions.getDraggedNodeId();
    pointerInteractions.finishDrag(event);
    clearPointerHover(draggedNodeId);
  }, [clearPointerHover, pointerInteractions]);
  const cancelPointerInteraction = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const draggedNodeId = pointerInteractions.getDraggedNodeId();
    pointerInteractions.cancelDrag(event);
    clearPointerHover(draggedNodeId);
  }, [clearPointerHover, pointerInteractions]);
  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    pointerInteractions.handlePointerMove(event);
    if (suppressHoverUntilPointerMoveRef.current) {
      suppressHoverUntilPointerMoveRef.current = false;
      suppressedHoverPathRef.current = null;
      return;
    }
    const suppressedPath = suppressedHoverPathRef.current;
    if (!suppressedPath) return;
    const target = event.target;
    const hoveredNode = target instanceof Element
      ? target.closest<SVGGElement>('[data-graph-node-position]')
      : null;
    if (hoveredNode?.dataset.graphNodePosition !== suppressedPath) {
      suppressedHoverPathRef.current = null;
    }
  }, [pointerInteractions]);
  useEffect(() => () => {
    if (hoverClearTimeoutRef.current !== null) window.clearTimeout(hoverClearTimeoutRef.current);
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <svg
        ref={svgRef}
        role="img"
        aria-label={t('app.viewGraph')}
        className="h-full w-full touch-none cursor-grab select-none"
        onPointerDown={startPan}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={cancelPointerInteraction}
        onPointerLeave={() => {
          if (hoverClearTimeoutRef.current !== null) {
            window.clearTimeout(hoverClearTimeoutRef.current);
            hoverClearTimeoutRef.current = null;
          }
          suppressHoverUntilPointerMoveRef.current = false;
          suppressedHoverPathRef.current = null;
          setHoveredPath(null);
        }}
        onWheel={handleWheel}
      >
        <GraphCanvasScene
          connectedToSelected={geometry.connectedToSelected}
          dragPositionId={dragPosition?.id ?? null}
          edges={geometry.edges}
          hoveredPath={visibleHoveredPath}
          labelsReady={labelsReadyGraph === props.graph}
          nodes={geometry.nodes}
          onHoverChange={handleHoverChange}
          onFocusChange={handleFocusChange}
          onOpen={props.onOpenPath}
          onPositionCommit={handlePositionCommit}
          onSelect={props.onSelectPath}
          onStartDrag={startNodeDrag}
          selectedPath={props.selectedPath}
          viewport={viewportController.viewport}
        />
      </svg>
    </div>
  );
}
