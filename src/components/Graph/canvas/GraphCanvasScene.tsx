import { memo, useMemo, type CSSProperties, type PointerEvent } from 'react';
import type { GraphViewport } from '../model/graphViewport';
import type { PositionedGraphEdge, PositionedGraphNode } from '../model/graphLayout';
import type { GraphNodePosition } from '../store/useGraphUIStore';
import { themeGraphTokens } from '@/styles/themeTokens';
import { GraphEdges } from './GraphEdges';
import { GraphNode } from './GraphNode';

export function GraphCanvasScene(props: {
  connectedToSelected: Set<string>;
  dragPositionId: string | null;
  edges: PositionedGraphEdge[];
  hoveredPath: string | null;
  labelsReady: boolean;
  nodes: PositionedGraphNode[];
  onHoverChange: (path: string | null) => void;
  onFocusChange: (path: string) => void;
  onOpen: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onSelect: (path: string) => void;
  onStartDrag: (event: PointerEvent<SVGGElement>, path: string, position: GraphNodePosition) => void;
  selectedPath: string | null;
  viewport: GraphViewport;
}) {
  const showAllLabels = props.labelsReady
    && props.viewport.zoom >= themeGraphTokens.labelVisibilityZoom;
  const overviewLabelIds = useMemo(() => {
    return new Set(
      [...props.nodes]
        .filter((node) => node.degree >= themeGraphTokens.overviewLabelMinDegree)
        .sort((left, right) => right.degree - left.degree || left.id.localeCompare(right.id))
        .slice(0, themeGraphTokens.overviewLabelMaxCount)
        .map((node) => node.id),
    );
  }, [props.nodes]);
  const showOverviewLabels = props.labelsReady
    && !showAllLabels
    && props.viewport.zoom >= themeGraphTokens.overviewLabelVisibilityZoom;
  return (
    <g
      transform={`translate(${props.viewport.x} ${props.viewport.y}) scale(${props.viewport.zoom})`}
      style={{
        [themeGraphTokens.inverseZoomProperty]: 1 / props.viewport.zoom,
      } as CSSProperties}
    >
      <GraphSceneContent
        connectedToSelected={props.connectedToSelected}
        dragPositionId={props.dragPositionId}
        edges={props.edges}
        hoveredPath={props.hoveredPath}
        overviewLabelIds={overviewLabelIds}
        nodes={props.nodes}
        onHoverChange={props.onHoverChange}
        onFocusChange={props.onFocusChange}
        onOpen={props.onOpen}
        onPositionCommit={props.onPositionCommit}
        onSelect={props.onSelect}
        onStartDrag={props.onStartDrag}
        selectedPath={props.selectedPath}
        showLabels={showAllLabels}
        showOverviewLabels={showOverviewLabels}
      />
    </g>
  );
}

const GraphSceneContent = memo(function GraphSceneContent(props: {
  connectedToSelected: Set<string>;
  dragPositionId: string | null;
  edges: PositionedGraphEdge[];
  hoveredPath: string | null;
  nodes: PositionedGraphNode[];
  overviewLabelIds: ReadonlySet<string>;
  onHoverChange: (path: string | null) => void;
  onFocusChange: (path: string) => void;
  onOpen: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onSelect: (path: string) => void;
  onStartDrag: (event: PointerEvent<SVGGElement>, path: string, position: GraphNodePosition) => void;
  selectedPath: string | null;
  showLabels: boolean;
  showOverviewLabels: boolean;
}) {
  const activePath = props.dragPositionId ?? props.hoveredPath;
  const highlightedPath = activePath ?? props.selectedPath;
  const connectedToHighlighted = useMemo(() => {
    if (!activePath) return props.connectedToSelected;
    const connected = new Set<string>();
    for (const edge of props.edges) {
      if (edge.source.id === activePath) connected.add(edge.target.id);
      if (edge.target.id === activePath) connected.add(edge.source.id);
    }
    return connected;
  }, [activePath, props.connectedToSelected, props.edges]);
  return (
    <g className="vlaina-graph-enter">
      <GraphEdges
        dragging={props.dragPositionId !== null}
        edges={props.edges}
        focused={Boolean(highlightedPath)}
        hoveredPath={highlightedPath}
      />
      {props.nodes.map((node) => (
        <GraphNode
          key={node.id}
          dragging={props.dragPositionId === node.id}
          hovered={activePath === node.id}
          node={node}
          onHoverChange={props.onHoverChange}
          onFocusChange={props.onFocusChange}
          onOpen={props.onOpen}
          onPositionCommit={props.onPositionCommit}
          onSelect={props.onSelect}
          onStartDrag={props.onStartDrag}
          related={connectedToHighlighted.has(node.id)}
          selected={props.selectedPath === node.id}
          dimmed={Boolean(highlightedPath && highlightedPath !== node.id && !connectedToHighlighted.has(node.id))}
          showLabel={props.showLabels || (
            props.showOverviewLabels && props.overviewLabelIds.has(node.id)
          )}
        />
      ))}
    </g>
  );
});
