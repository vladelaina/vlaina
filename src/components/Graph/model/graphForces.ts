import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { themeGraphTokens } from '@/styles/themeTokens';
import type { PositionedGraphNode } from './graphLayout';
import type { NoteGraphEdge } from './noteGraph';

export interface GraphForceNode extends SimulationNodeDatum {
  degree: number;
  id: string;
  x: number;
  y: number;
}

export interface GraphForceLink extends SimulationLinkDatum<GraphForceNode> {
  source: string | GraphForceNode;
  target: string | GraphForceNode;
}

export function createGraphForceNodes(nodes: readonly PositionedGraphNode[]): GraphForceNode[] {
  return nodes.map((node) => ({ degree: node.degree, id: node.id, x: node.x, y: node.y }));
}

export function createGraphForceLinks(edges: readonly NoteGraphEdge[]): GraphForceLink[] {
  return edges.map((edge) => ({ source: edge.source, target: edge.target }));
}

export function createGraphForceSimulation(
  nodes: GraphForceNode[],
  links: GraphForceLink[],
): Simulation<GraphForceNode, GraphForceLink> {
  return forceSimulation<GraphForceNode>(nodes)
    .alphaMin(themeGraphTokens.forceMinimumAlpha)
    .alphaDecay(themeGraphTokens.forceAlphaDecay)
    .velocityDecay(themeGraphTokens.forceVelocityDecay)
    .force('charge', forceManyBody<GraphForceNode>()
      .strength((node) => (
        themeGraphTokens.forceRepelStrength * Math.sqrt(Math.max(1, node.degree))
      ))
      .theta(themeGraphTokens.forceChargeTheta)
      .distanceMax(themeGraphTokens.forceRepelDistanceMaxPx))
    .force('link', forceLink<GraphForceNode, GraphForceLink>(links)
      .id((node) => node.id)
      .distance(themeGraphTokens.forceLinkDistancePx)
      .strength(themeGraphTokens.forceLinkStrength))
    .force('collision', forceCollide<GraphForceNode>(themeGraphTokens.forceCollisionRadiusPx)
      .strength(themeGraphTokens.forceCollisionStrength))
    .force('x', forceX<GraphForceNode>(themeGraphTokens.viewBoxWidthPx / 2)
      .strength(themeGraphTokens.forceCenterStrength))
    .force('y', forceY<GraphForceNode>(themeGraphTokens.viewBoxHeightPx / 2)
      .strength(themeGraphTokens.forceCenterStrength))
    .stop();
}
