import { useEffect, useMemo, useRef } from 'react';
import type { Force } from 'd3-force';
import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';
import { themeGraphTokens } from '@/styles/themeTokens';
import {
  createGraphForceLinks,
  createGraphForceNodes,
  createGraphForceSimulation,
  type GraphForceLink,
  type GraphForceNode,
} from '../model/graphForces';
import {
  cloneGraphNodePositions,
  setGraphNodePosition,
  syncGraphNodePositions,
} from '../model/graphPositionSnapshot';
import {
  beginGraphForceReleaseDiagnostic,
  finishGraphForceReleaseDiagnostic,
  type GraphForceReleaseDiagnostic,
} from '../model/graphForceReleaseDiagnostics';
import type { PositionedNoteGraph } from '../model/graphLayout';
import type { GraphNodePosition, GraphNodePositions } from '../store/useGraphUIStore';

const GRAPH_FORCE_NAMES = ['charge', 'link', 'collision', 'x', 'y'] as const;

export function useGraphForceSimulation(args: {
  dragPosition: { id: string; position: GraphNodePosition } | null;
  graph: PositionedNoteGraph;
  onPositionsCommit: (positions: GraphNodePositions) => void;
  onDraggedPositionFrame: (id: string, position: GraphNodePosition) => void;
  onPositionsFrame: (positions: GraphNodePositions) => void;
  onPositionsInitialized: (positions: GraphNodePositions) => void;
  positionOverrides: GraphNodePositions;
}) {
  const positionsRef = useRef<GraphNodePositions>({});
  const nodesByIdRef = useRef(new Map<string, GraphForceNode>());
  const simulationRef = useRef<ReturnType<typeof createGraphForceSimulation> | null>(null);
  const previousDragIdRef = useRef<string | null>(null);
  const movedDragIdRef = useRef<string | null>(null);
  const releasedDragIdRef = useRef<string | null>(null);
  const forcesRef = useRef(new Map<string, Force<GraphForceNode, GraphForceLink>>());
  const forcesSuspendedRef = useRef(false);
  const releaseDiagnosticRef = useRef<GraphForceReleaseDiagnostic | null>(null);
  const graphRef = useRef(args.graph);
  const overridesRef = useRef(args.positionOverrides);
  const dragRef = useRef(args.dragPosition);
  const commitRef = useRef(args.onPositionsCommit);
  const draggedFrameRef = useRef(args.onDraggedPositionFrame);
  const frameRef = useRef(args.onPositionsFrame);
  const initializedRef = useRef(args.onPositionsInitialized);
  graphRef.current = args.graph;
  overridesRef.current = args.positionOverrides;
  dragRef.current = args.dragPosition;
  commitRef.current = args.onPositionsCommit;
  draggedFrameRef.current = args.onDraggedPositionFrame;
  frameRef.current = args.onPositionsFrame;
  initializedRef.current = args.onPositionsInitialized;

  const graphKey = useMemo(() => [
    args.graph.nodes.map((node) => node.id).join('\n'),
    args.graph.edges.map((edge) => `${edge.source.id}>${edge.target.id}`).join('\n'),
  ].join('\n--\n'), [args.graph.edges, args.graph.nodes]);

  const readPositions = (): GraphNodePositions => syncGraphNodePositions(
    nodesByIdRef.current,
    positionsRef.current,
  );

  const initializeSimulation = (useOverrides = true) => {
    simulationRef.current?.stop();
    const nodes = createGraphForceNodes(graphRef.current.nodes.map((node) => ({
      ...node,
      ...(useOverrides ? overridesRef.current[node.id] : null),
    })));
    nodesByIdRef.current = new Map(nodes.map((node) => [node.id, node]));
    const simulation = createGraphForceSimulation(
      nodes,
      createGraphForceLinks(graphRef.current.edges.map((edge) => ({
        source: edge.source.id,
        target: edge.target.id,
      }))),
    );
    forcesRef.current = new Map(GRAPH_FORCE_NAMES.flatMap((name) => {
      const force = simulation.force(name);
      return force ? [[name, force]] : [];
    }));
    forcesSuspendedRef.current = false;
    releasedDragIdRef.current = null;
    releaseDiagnosticRef.current = null;
    simulation.on('tick', () => {
      const positions = readPositions();
      positionsRef.current = positions;
      frameRef.current(positions);
    });
    simulation.on('end', () => {
      if (dragRef.current) return;
      const positions = readPositions();
      positionsRef.current = positions;
      frameRef.current(positions);
      const releaseDiagnostic = releaseDiagnosticRef.current;
      if (releaseDiagnostic) {
        finishGraphForceReleaseDiagnostic(releaseDiagnostic, positions);
        releaseDiagnosticRef.current = null;
      }
      commitRef.current(cloneGraphNodePositions(positions));
    });
    const hasCompleteLayout = useOverrides && nodes.every((node) => (
      overridesRef.current[node.id] !== undefined
    ));
    if (!hasCompleteLayout) {
      const anchoredNodes = useOverrides
        ? nodes.filter((node) => overridesRef.current[node.id] !== undefined)
        : [];
      for (const node of anchoredNodes) {
        node.fx = node.x;
        node.fy = node.y;
      }
      simulation.alpha(1).tick(themeGraphTokens.forceInitialIterations);
      for (const node of anchoredNodes) {
        node.fx = null;
        node.fy = null;
      }
    }
    const positions = readPositions();
    positionsRef.current = positions;
    frameRef.current(positions);
    initializedRef.current(positions);
    simulationRef.current = simulation;
  };

  useEffect(() => {
    previousDragIdRef.current = null;
    movedDragIdRef.current = null;
    positionsRef.current = {};
    initializeSimulation();
  }, [graphKey]);

  const releaseDragPosition = (id: string) => {
    const simulation = simulationRef.current;
    if (!simulation || releasedDragIdRef.current === id) return;
    const node = nodesByIdRef.current.get(id);
    if (node) {
      if (movedDragIdRef.current === id) {
        node.fx = node.x;
        node.fy = node.y;
      } else {
        node.fx = null;
        node.fy = null;
      }
    }
    movedDragIdRef.current = null;
    GRAPH_FORCE_NAMES.forEach((name) => simulation.force(name, null));
    forcesSuspendedRef.current = true;
    const releasedNodeIds = new Set<string>([id]);
    for (const edge of graphRef.current.edges) {
      if (edge.source.id === id) releasedNodeIds.add(edge.target.id);
      if (edge.target.id === id) releasedNodeIds.add(edge.source.id);
    }
    for (const [nodeId, forceNode] of nodesByIdRef.current) {
      if (!releasedNodeIds.has(nodeId) || nodeId === id) {
        forceNode.vx = 0;
        forceNode.vy = 0;
        continue;
      }
      const speed = Math.hypot(forceNode.vx ?? 0, forceNode.vy ?? 0);
      if (speed <= themeGraphTokens.forceReleaseVelocityMaxPxPerFrame) continue;
      const scale = themeGraphTokens.forceReleaseVelocityMaxPxPerFrame / speed;
      forceNode.vx = (forceNode.vx ?? 0) * scale;
      forceNode.vy = (forceNode.vy ?? 0) * scale;
    }
    simulation
      .alphaDecay(themeGraphTokens.forceReleaseAlphaDecay)
      .velocityDecay(themeGraphTokens.forceReleaseVelocityDecay)
      .alphaTarget(0);
    releaseDiagnosticRef.current = beginGraphForceReleaseDiagnostic({
      alpha: simulation.alpha(),
      id,
      nodeIds: releasedNodeIds,
      nodesById: nodesByIdRef.current,
    });
    releasedDragIdRef.current = id;
  };

  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    const drag = args.dragPosition;
    const previousDragId = previousDragIdRef.current;
    if (drag) {
      releasedDragIdRef.current = null;
      if (releaseDiagnosticRef.current) {
        logDiagnostic('graph', 'force-release-interrupted', {
          durationMs: Math.round(performance.now() - releaseDiagnosticRef.current.startedAt),
          id: releaseDiagnosticRef.current.id,
        });
        releaseDiagnosticRef.current = null;
      }
      if (forcesSuspendedRef.current) {
        forcesRef.current.forEach((force, name) => simulation.force(name, force));
        forcesSuspendedRef.current = false;
      }
      const node = nodesByIdRef.current.get(drag.id);
      if (node) {
        node.fx = drag.position.x;
        node.fy = drag.position.y;
      }
      simulation
        .alphaDecay(themeGraphTokens.forceAlphaDecay)
        .velocityDecay(themeGraphTokens.forceVelocityDecay)
        .alpha(Math.max(simulation.alpha(), themeGraphTokens.forceDragAlpha))
        .alphaTarget(themeGraphTokens.forceDragAlphaTarget)
        .restart();
    } else if (previousDragId) releaseDragPosition(previousDragId);
    previousDragIdRef.current = drag?.id ?? null;
  }, [args.dragPosition]);

  useEffect(() => {
    if (dragRef.current) return;
    if (releaseDiagnosticRef.current) {
      logDiagnostic('graph', 'position-overrides-deferred', {
        id: releaseDiagnosticRef.current.id,
        positionCount: Object.keys(args.positionOverrides).length,
      });
      return;
    }
    for (const [id, position] of Object.entries(args.positionOverrides)) {
      const node = nodesByIdRef.current.get(id);
      if (!node) continue;
      node.x = position.x;
      node.y = position.y;
      node.vx = 0;
      node.vy = 0;
    }
  }, [args.positionOverrides]);

  useEffect(() => () => {
    simulationRef.current?.stop();
  }, []);

  const updateDragPosition = (id: string, position: GraphNodePosition) => {
    const node = nodesByIdRef.current.get(id);
    const simulation = simulationRef.current;
    if (!node || !simulation) return;
    movedDragIdRef.current = id;
    releasedDragIdRef.current = null;
    node.x = position.x;
    node.y = position.y;
    node.fx = position.x;
    node.fy = position.y;
    node.vx = 0;
    node.vy = 0;
    setGraphNodePosition(positionsRef.current, id, position);
    draggedFrameRef.current(id, position);
    simulation
      .alpha(Math.max(simulation.alpha(), themeGraphTokens.forceDragAlpha))
      .alphaTarget(themeGraphTokens.forceDragAlphaTarget)
      .restart();
  };

  return { positionsRef, releaseDragPosition, updateDragPosition };
}
