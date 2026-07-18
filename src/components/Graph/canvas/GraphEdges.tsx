import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { themeGraphTokens } from '@/styles/themeTokens';
import type { PositionedGraphEdge } from '../model/graphLayout';
import { registerGraphEdgeLayer } from './applyGraphPositions';

function createEdgePath(edges: readonly PositionedGraphEdge[]): string {
  return edges.map((edge) => (
    `M${edge.source.x},${edge.source.y}L${edge.target.x},${edge.target.y}`
  )).join('');
}

function getEdgeDefinitions(edges: readonly PositionedGraphEdge[]) {
  return edges.map((edge) => ({
    sourceId: edge.source.id,
    targetId: edge.target.id,
  }));
}

export const GraphEdges = memo(function GraphEdges(props: {
  edges: PositionedGraphEdge[];
  hoveredPath: string | null;
}) {
  const [lastHoveredPath, setLastHoveredPath] = useState(props.hoveredPath);
  const activeHoveredPath = props.hoveredPath ?? lastHoveredPath;
  const baseDefinitions = useMemo(() => getEdgeDefinitions(props.edges), [props.edges]);
  const basePath = useMemo(() => createEdgePath(props.edges), [props.edges]);
  const highlightedEdges = useMemo(() => activeHoveredPath
    ? props.edges.filter((edge) => (
      activeHoveredPath === edge.source.id || activeHoveredPath === edge.target.id
    ))
    : [], [activeHoveredPath, props.edges]);
  const activeDefinitions = useMemo(
    () => getEdgeDefinitions(highlightedEdges),
    [highlightedEdges],
  );
  const activePath = useMemo(() => createEdgePath(highlightedEdges), [highlightedEdges]);
  const registerBaseLayer = useCallback((element: SVGPathElement | null) => {
    registerGraphEdgeLayer(element, 'base', baseDefinitions);
  }, [baseDefinitions]);
  const registerActiveLayer = useCallback((element: SVGPathElement | null) => {
    registerGraphEdgeLayer(element, 'active', activeDefinitions);
  }, [activeDefinitions]);

  useEffect(() => {
    if (props.hoveredPath) {
      setLastHoveredPath(props.hoveredPath);
      return;
    }
    if (!lastHoveredPath) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setLastHoveredPath(null);
      return;
    }
    const timeout = window.setTimeout(
      () => setLastHoveredPath(null),
      themeGraphTokens.edgeHighlightFadeDurationMs,
    );
    return () => window.clearTimeout(timeout);
  }, [lastHoveredPath, props.hoveredPath]);

  return (
    <g aria-hidden="true" className="vlaina-graph-edge-enter pointer-events-none">
      <path
        ref={registerBaseLayer}
        data-graph-edge-count={props.edges.length}
        data-graph-edge-layer="base"
        d={basePath}
        fill={themeGraphTokens.edgeFill}
        stroke="var(--vlaina-color-graph-edge)"
        strokeOpacity={themeGraphTokens.edgeOpacity}
        strokeWidth={themeGraphTokens.edgeWidthPx}
        vectorEffect="non-scaling-stroke"
      />
      <path
        ref={registerActiveLayer}
        data-graph-edge-layer="active"
        className="vlaina-graph-edge-active"
        d={activePath}
        fill={themeGraphTokens.edgeFill}
        opacity={props.hoveredPath ? 1 : 0}
        stroke="var(--vlaina-color-graph-edge-active)"
        strokeOpacity={themeGraphTokens.activeEdgeOpacity}
        strokeWidth={themeGraphTokens.activeEdgeWidthPx}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
});
