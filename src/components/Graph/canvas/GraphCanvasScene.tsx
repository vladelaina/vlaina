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
  nodes: PositionedGraphNode[];
  onHoverChange: (path: string | null) => void;
  onOpen: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onSelect: (path: string) => void;
  onStartDrag: (event: PointerEvent<SVGGElement>, path: string, position: GraphNodePosition) => void;
  selectedPath: string | null;
  viewport: GraphViewport;
}) {
  const showLabels = props.viewport.zoom >= themeGraphTokens.labelVisibilityZoom;
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
        nodes={props.nodes}
        onHoverChange={props.onHoverChange}
        onOpen={props.onOpen}
        onPositionCommit={props.onPositionCommit}
        onSelect={props.onSelect}
        onStartDrag={props.onStartDrag}
        selectedPath={props.selectedPath}
        showLabels={showLabels}
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
  onHoverChange: (path: string | null) => void;
  onOpen: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onSelect: (path: string) => void;
  onStartDrag: (event: PointerEvent<SVGGElement>, path: string, position: GraphNodePosition) => void;
  selectedPath: string | null;
  showLabels: boolean;
}) {
  const activePath = props.dragPositionId ?? props.hoveredPath;
  const enterIndexById = useMemo(() => {
    const focusNode = props.nodes.find((node) => node.id === props.selectedPath)
      ?? props.nodes[0];
    if (!focusNode) return new Map<string, number>();
    return new Map(
      [...props.nodes]
        .sort((left, right) => (
          Math.hypot(left.x - focusNode.x, left.y - focusNode.y)
          - Math.hypot(right.x - focusNode.x, right.y - focusNode.y)
          || right.degree - left.degree
          || left.id.localeCompare(right.id)
        ))
        .map((node, index) => [node.id, index]),
    );
  }, [props.nodes, props.selectedPath]);

  return (
    <>
      <GraphEdges
        edges={props.edges}
        hoveredPath={activePath}
      />
      {props.nodes.map((node) => (
        <GraphNode
          key={node.id}
          dragging={props.dragPositionId === node.id}
          enterIndex={enterIndexById.get(node.id) ?? 0}
          hovered={activePath === node.id}
          node={node}
          onHoverChange={props.onHoverChange}
          onOpen={props.onOpen}
          onPositionCommit={props.onPositionCommit}
          onSelect={props.onSelect}
          onStartDrag={props.onStartDrag}
          related={props.connectedToSelected.has(node.id)}
          selected={props.selectedPath === node.id}
          showLabel={props.showLabels}
        />
      ))}
    </>
  );
});
