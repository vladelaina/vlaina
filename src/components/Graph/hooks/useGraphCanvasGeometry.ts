import { useMemo } from 'react';
import type { PositionedNoteGraph } from '../model/graphLayout';
import type { GraphNodePosition, GraphNodePositions } from '../store/useGraphUIStore';

export function useGraphCanvasGeometry(args: {
  dragPosition: { id: string; position: GraphNodePosition } | null;
  graph: PositionedNoteGraph;
  positionOverrides: GraphNodePositions;
  selectedPath: string | null;
  simulationPositions: GraphNodePositions;
}) {
  const nodes = useMemo(() => args.graph.nodes.map((node) => {
    const position = args.simulationPositions[node.id]
      ?? (args.dragPosition?.id === node.id
        ? args.dragPosition.position
        : args.positionOverrides[node.id]);
    return position ? { ...node, ...position } : node;
  }), [args.dragPosition, args.graph.nodes, args.positionOverrides, args.simulationPositions]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edges = useMemo(() => args.graph.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source.id);
    const target = nodeById.get(edge.target.id);
    return source && target ? [{ source, target }] : [];
  }), [args.graph.edges, nodeById]);
  const connectedToSelected = useMemo(() => {
    const connected = new Set<string>();
    if (!args.selectedPath) return connected;
    for (const edge of edges) {
      if (edge.source.id === args.selectedPath) connected.add(edge.target.id);
      if (edge.target.id === args.selectedPath) connected.add(edge.source.id);
    }
    return connected;
  }, [args.selectedPath, edges]);
  const nodeKey = useMemo(() => nodes.map((node) => node.id).join('\n'), [nodes]);

  return { connectedToSelected, edges, nodeKey, nodes };
}
