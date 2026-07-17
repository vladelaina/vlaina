import { describe, expect, it } from 'vitest';
import {
  createGraphForceLinks,
  createGraphForceNodes,
  createGraphForceSimulation,
} from './graphForces';
import type { PositionedGraphNode } from './graphLayout';

function node(id: string, x: number, y: number): PositionedGraphNode {
  return { id, label: id, degree: 1, x, y };
}

describe('graph forces', () => {
  it('pulls linked nodes toward their target distance', () => {
    const nodes = createGraphForceNodes([node('a', 100, 380), node('b', 500, 380)]);
    const simulation = createGraphForceSimulation(
      nodes,
      createGraphForceLinks([{ source: 'a', target: 'b' }]),
    ).alpha(0.7);
    const before = Math.abs(nodes[1]!.x - nodes[0]!.x);
    simulation.tick(20);

    expect(Math.abs(nodes[1]!.x - nodes[0]!.x)).toBeLessThan(before);
  });

  it('moves a linked neighbor while keeping the dragged node fixed', () => {
    const nodes = createGraphForceNodes([node('a', 100, 380), node('b', 250, 380)]);
    nodes[0]!.fx = 500;
    nodes[0]!.fy = 420;
    const simulation = createGraphForceSimulation(
      nodes,
      createGraphForceLinks([{ source: 'a', target: 'b' }]),
    ).alpha(0.8);
    const beforeNeighborX = nodes[1]!.x;
    simulation.tick(2);

    expect(nodes[0]).toMatchObject({ x: 500, y: 420, vx: 0, vy: 0 });
    expect(nodes[1]!.x).toBeGreaterThan(beforeNeighborX);
  });

  it('separates overlapping unlinked nodes without producing invalid coordinates', () => {
    const nodes = createGraphForceNodes([node('a', 300, 300), node('b', 300, 300)]);
    createGraphForceSimulation(nodes, []).alpha(0.8).tick(8);

    expect(Math.hypot(nodes[0]!.x - nodes[1]!.x, nodes[0]!.y - nodes[1]!.y)).toBeGreaterThan(0);
    expect(nodes.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
  });
});
