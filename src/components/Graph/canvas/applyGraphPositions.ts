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
}

const elementsBySvg = new WeakMap<SVGSVGElement, GraphPositionElements>();
const edgeLayersBySvg = new WeakMap<SVGSVGElement, Map<string, GraphEdgeLayer>>();

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
  };
  elementsBySvg.set(svg, elements);
  return elements;
}

export function applyDraggedGraphNodePosition(
  svg: SVGSVGElement | null,
  id: string,
  position: { x: number; y: number },
) {
  if (!svg) return;
  const node = getGraphPositionElements(svg).nodesById.get(id);
  node?.element.setAttribute('transform', `translate(${position.x} ${position.y})`);
}

export function applyGraphPositions(
  svg: SVGSVGElement | null,
  positions: GraphNodePositions,
  updateEdges = true,
) {
  if (!svg) return;
  const elements = getGraphPositionElements(svg);
  for (const node of elements.nodes) {
    const position = positions[node.id];
    if (!position) continue;
    node.element.setAttribute('transform', `translate(${position.x} ${position.y})`);
  }
  if (!updateEdges) return;
  for (const layer of edgeLayersBySvg.get(svg)?.values() ?? []) {
    if (!layer.element.isConnected) continue;
    let path = '';
    for (const edge of layer.edges) {
      const source = positions[edge.sourceId];
      const target = positions[edge.targetId];
      if (source && target) {
        path += `M${source.x},${source.y}L${target.x},${target.y}`;
      }
    }
    layer.element.setAttribute('d', path);
  }
}
