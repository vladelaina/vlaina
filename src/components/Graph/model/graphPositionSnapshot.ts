import type { GraphNodePosition, GraphNodePositions } from '../store/useGraphUIStore';

export function setGraphNodePosition(
  positions: GraphNodePositions,
  id: string,
  next: GraphNodePosition,
) {
  const current = positions[id];
  if (current) {
    current.x = next.x;
    current.y = next.y;
  } else {
    positions[id] = { x: next.x, y: next.y };
  }
}

export function syncGraphNodePositions(
  nodes: ReadonlyMap<string, GraphNodePosition>,
  positions: GraphNodePositions,
): GraphNodePositions {
  for (const [id, node] of nodes) setGraphNodePosition(positions, id, node);
  return positions;
}

export function cloneGraphNodePositions(positions: GraphNodePositions): GraphNodePositions {
  const clone: GraphNodePositions = {};
  for (const [id, position] of Object.entries(positions)) {
    clone[id] = { x: position.x, y: position.y };
  }
  return clone;
}
