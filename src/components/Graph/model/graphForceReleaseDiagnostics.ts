import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';
import type { GraphNodePositions } from '../store/useGraphUIStore';
import type { GraphForceNode } from './graphForces';

export interface GraphForceReleaseDiagnostic {
  id: string;
  neighborIds: string[];
  positions: GraphNodePositions;
  startedAt: number;
}

function roundGraphMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function beginGraphForceReleaseDiagnostic(args: {
  alpha: number;
  id: string;
  nodeIds: ReadonlySet<string>;
  nodesById: ReadonlyMap<string, GraphForceNode>;
}): GraphForceReleaseDiagnostic {
  const neighborIds = [...args.nodeIds].filter((nodeId) => nodeId !== args.id);
  const positions: GraphNodePositions = {};
  args.nodeIds.forEach((nodeId) => {
    const node = args.nodesById.get(nodeId);
    if (node) positions[nodeId] = { x: node.x, y: node.y };
  });
  logDiagnostic('graph', 'force-release', {
    alpha: roundGraphMetric(args.alpha),
    id: args.id,
    neighborCount: neighborIds.length,
    neighbors: neighborIds.slice(0, 16).map((nodeId) => {
      const node = args.nodesById.get(nodeId);
      return {
        id: nodeId,
        speed: node ? roundGraphMetric(Math.hypot(node.vx ?? 0, node.vy ?? 0)) : null,
        x: node ? roundGraphMetric(node.x) : null,
        y: node ? roundGraphMetric(node.y) : null,
      };
    }),
  });
  return { id: args.id, neighborIds, positions, startedAt: performance.now() };
}

export function finishGraphForceReleaseDiagnostic(
  diagnostic: GraphForceReleaseDiagnostic,
  positions: GraphNodePositions,
) {
  const neighborTravel = diagnostic.neighborIds.map((id) => {
    const start = diagnostic.positions[id];
    const end = positions[id];
    return {
      id,
      travel: start && end
        ? roundGraphMetric(Math.hypot(end.x - start.x, end.y - start.y))
        : null,
    };
  });
  const travelValues = neighborTravel.flatMap(({ travel }) => travel === null ? [] : [travel]);
  logDiagnostic('graph', 'force-settled', {
    averageNeighborTravel: travelValues.length > 0
      ? roundGraphMetric(travelValues.reduce((sum, value) => sum + value, 0) / travelValues.length)
      : 0,
    durationMs: Math.round(performance.now() - diagnostic.startedAt),
    id: diagnostic.id,
    maxNeighborTravel: travelValues.length > 0 ? Math.max(...travelValues) : 0,
    neighborTravel: neighborTravel.slice(0, 16),
  });
}
