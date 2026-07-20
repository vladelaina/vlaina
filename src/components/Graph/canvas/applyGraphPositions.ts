import type { GraphNodePositions } from '../store/useGraphUIStore';

interface GraphNodeElements {
  element: SVGGElement;
  id: string;
}

interface GraphEdgeDefinition {
  sourceId: string;
  targetId: string;
}

interface GraphEdgeLayer {
  edges: GraphEdgeDefinition[];
  element: SVGPathElement;
}

interface GraphPositionElements {
  nodes: GraphNodeElements[];
  nodesById: Map<string, GraphNodeElements>;
  positionsById: Map<string, { x: number; y: number }>;
}

const elementsBySvg = new WeakMap<SVGSVGElement, GraphPositionElements>();
const edgeLayersBySvg = new WeakMap<SVGSVGElement, Map<string, GraphEdgeLayer>>();
export type GraphEdgeUpdateMode = 'active' | 'all' | 'none';

export function registerGraphEdgeLayer(
  element: SVGPathElement | null,
  layerId: string,
  edges: GraphEdgeDefinition[],
) {
  const svg = element?.ownerSVGElement;
  if (!element || !svg) return;
  const layers = edgeLayersBySvg.get(svg) ?? new Map<string, GraphEdgeLayer>();
  layers.set(layerId, { edges, element });
  edgeLayersBySvg.set(svg, layers);
}

export function clearGraphPositionElements(svg: SVGSVGElement | null) {
  if (!svg) return;
  elementsBySvg.delete(svg);
  edgeLayersBySvg.delete(svg);
}

function getGraphPositionElements(svg: SVGSVGElement): GraphPositionElements {
  const cached = elementsBySvg.get(svg);
  if (
    cached
    && (cached.nodes.length === 0 || cached.nodes[0]!.element.isConnected)
  ) {
    return cached;
  }

  const nodes = [...svg.querySelectorAll<SVGGElement>('[data-graph-node-position]')].map((group) => ({
    element: group,
    id: group.dataset.graphNodePosition ?? '',
  }));
  const elements = {
    nodes,
    nodesById: new Map(nodes.map((node) => [node.id, node])),
    positionsById: new Map<string, { x: number; y: number }>(),
  };
  elementsBySvg.set(svg, elements);
  return elements;
}

function updateEdgePaths(
  svg: SVGSVGElement,
  positions: ReadonlyMap<string, { x: number; y: number }>,
  shouldUpdate: (layerId: string) => boolean = () => true,
) {
  for (const [layerId, layer] of edgeLayersBySvg.get(svg)?.entries() ?? []) {
    if (!shouldUpdate(layerId)) continue;
    if (!layer.element.isConnected) continue;
    const path: string[] = [];
    for (const edge of layer.edges) {
      const source = positions.get(edge.sourceId);
      const target = positions.get(edge.targetId);
      if (source && target) path.push(`M${source.x},${source.y}L${target.x},${target.y}`);
    }
    layer.element.setAttribute('d', path.join(''));
  }
}

export function applyDraggedGraphNodePosition(
  svg: SVGSVGElement | null,
  id: string,
  position: { x: number; y: number },
) {
  if (!svg) return;
  const elements = getGraphPositionElements(svg);
  const node = elements.nodesById.get(id);
  elements.positionsById.set(id, position);
  node?.element.setAttribute('transform', `translate(${position.x} ${position.y})`);
  updateEdgePaths(svg, elements.positionsById, (layerId) => layerId === 'active');
}

export function applyGraphPositions(
  svg: SVGSVGElement | null,
  positions: GraphNodePositions,
  edgeUpdateMode: GraphEdgeUpdateMode = 'all',
) {
  if (!svg) return;
  const elements = getGraphPositionElements(svg);
  for (const node of elements.nodes) {
    const position = positions[node.id];
    if (!position) continue;
    elements.positionsById.set(node.id, position);
    node.element.setAttribute('transform', `translate(${position.x} ${position.y})`);
  }
  if (edgeUpdateMode === 'none') return;
  updateEdgePaths(
    svg,
    elements.positionsById,
    edgeUpdateMode === 'active' ? (layerId) => layerId === 'active' : undefined,
  );
}
