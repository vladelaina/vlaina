import { useCallback, useRef, useState } from 'react';
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
  if (graphRef.current !== props.graph) {
    clearGraphPositionElements(svgRef.current);
    graphRef.current = props.graph;
  }
  const forceFrameRef = useRef(0);
  const [forceLayoutVersion, setForceLayoutVersion] = useState(0);
  const [dragPosition, setDragPosition] = useState<{
    id: string;
    position: GraphNodePosition;
  } | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const handlePositionsFrame = useCallback((positions: GraphNodePositions) => {
    const updateEdges = forceFrameRef.current % themeGraphTokens.edgeAnimationFrameInterval === 0;
    forceFrameRef.current += 1;
    applyGraphPositions(svgRef.current, positions, updateEdges);
  }, []);
  const handlePositionsInitialized = useCallback(() => {
    setForceLayoutVersion((current) => current + 1);
  }, []);
  const forceSimulation = useGraphForceSimulation({
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
  const geometry = useGraphCanvasGeometry({
    dragPosition,
    graph: props.graph,
    positionOverrides: props.positionOverrides,
    selectedPath: props.selectedPath,
    simulationPositions: forceSimulation.positionsRef.current,
  });
  const viewportController = useGraphViewportController({
    nodeKey: `${geometry.nodeKey}\n${forceLayoutVersion}`,
    nodes: geometry.nodes,
    selectedPath: props.selectedPath,
    svgRef,
  });
  const pointerInteractions = useGraphPointerInteractions({
    onDragPosition: forceSimulation.updateDragPosition,
    onOpenPath: props.onOpenPath,
    onPositionCommit: props.onPositionCommit,
    onReleaseDrag: forceSimulation.releaseDragPosition,
    onSelectPath: props.onSelectPath,
    setDragPosition,
    setViewport: viewportController.setViewport,
    svgRef,
    viewport: viewportController.viewport,
  });

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <svg
        ref={svgRef}
        role="img"
        aria-label={t('app.viewGraph')}
        className="h-full w-full touch-none cursor-grab select-none"
        onPointerDown={pointerInteractions.startPan}
        onPointerMove={pointerInteractions.handlePointerMove}
        onPointerUp={pointerInteractions.finishDrag}
        onPointerCancel={pointerInteractions.finishDrag}
        onWheel={viewportController.handleWheel}
      >
        <GraphCanvasScene
          connectedToSelected={geometry.connectedToSelected}
          dragPositionId={dragPosition?.id ?? null}
          edges={geometry.edges}
          hoveredPath={hoveredPath}
          nodes={geometry.nodes}
          onHoverChange={setHoveredPath}
          onOpen={props.onOpenPath}
          onPositionCommit={props.onPositionCommit}
          onSelect={props.onSelectPath}
          onStartDrag={pointerInteractions.startNodeDrag}
          selectedPath={props.selectedPath}
          viewport={viewportController.viewport}
        />
      </svg>
    </div>
  );
}
