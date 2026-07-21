import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
} from '../model/graphPositionSnapshot';
import {
  beginGraphForceReleaseDiagnostic,
  finishGraphForceReleaseDiagnostic,
  type GraphForceReleaseDiagnostic,
} from '../model/graphForceReleaseDiagnostics';
import type { PositionedNoteGraph } from '../model/graphLayout';
import type { GraphNodePosition, GraphNodePositions } from '../store/useGraphUIStore';

const GRAPH_FORCE_NAMES = ['charge', 'link', 'collision', 'x', 'y'] as const;

interface SavedLayoutEntrance {
  frameId: number | null;
  from: GraphNodePositions;
  targets: GraphNodePositions;
}

export function useGraphForceSimulation(args: {
  active: boolean;
  dragPosition: { id: string; position: GraphNodePosition } | null;
  graph: PositionedNoteGraph;
  onPositionsCommit: (positions: GraphNodePositions) => void;
  onDraggedPositionFrame: (id: string, position: GraphNodePosition) => void;
  onPositionsFrame: (positions: GraphNodePositions) => void;
  onPositionsInitialized: (positions: GraphNodePositions) => void;
  positionOverrides: GraphNodePositions;
}) {
  const positionsRef = useRef<GraphNodePositions>({});
  const retainedPositionsRef = useRef<GraphNodePositions>({});
  const nodesByIdRef = useRef(new Map<string, GraphForceNode>());
  const simulationRef = useRef<ReturnType<typeof createGraphForceSimulation> | null>(null);
  const initialSimulationPendingRef = useRef(false);
  const savedLayoutEntranceRef = useRef<SavedLayoutEntrance | null>(null);
  const previousDragIdRef = useRef<string | null>(null);
  const movedDragIdRef = useRef<string | null>(null);
  const releasedDragIdRef = useRef<string | null>(null);
  const forcesRef = useRef(new Map<string, Force<GraphForceNode, GraphForceLink>>());
  const forcesSuspendedRef = useRef(false);
  const releaseDiagnosticRef = useRef<GraphForceReleaseDiagnostic | null>(null);
  const graphRef = useRef(args.graph);
  const activeRef = useRef(args.active);
  const overridesRef = useRef(args.positionOverrides);
  const dragRef = useRef(args.dragPosition);
  const commitRef = useRef(args.onPositionsCommit);
  const draggedFrameRef = useRef(args.onDraggedPositionFrame);
  const frameRef = useRef(args.onPositionsFrame);
  const initializedRef = useRef(args.onPositionsInitialized);
  graphRef.current = args.graph;
  activeRef.current = args.active;
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

  const readPositions = (): GraphNodePositions => {
    const positions = positionsRef.current;
    const retainedPositions = retainedPositionsRef.current;
    for (const [id, node] of nodesByIdRef.current) {
      setGraphNodePosition(retainedPositions, id, node);
      positions[id] = retainedPositions[id]!;
    }
    return positions;
  };

  const stopSavedLayoutEntrance = () => {
    const entrance = savedLayoutEntranceRef.current;
    if (entrance?.frameId !== null && entrance?.frameId !== undefined) {
      window.cancelAnimationFrame(entrance.frameId);
      entrance.frameId = null;
      entrance.from = cloneGraphNodePositions(positionsRef.current);
    }
  };

  const startSavedLayoutEntrance = () => {
    const entrance = savedLayoutEntranceRef.current;
    if (!entrance || entrance.frameId !== null) return;
    const startedAt = performance.now();
    const step = (now: number) => {
      const currentEntrance = savedLayoutEntranceRef.current;
      if (!currentEntrance) return;
      const progress = Math.min(1, Math.max(
        0,
        (now - startedAt) / themeGraphTokens.savedLayoutEntranceDurationMs,
      ));
      const eased = 1 - (1 - progress) ** 3;
      for (const [id, target] of Object.entries(currentEntrance.targets)) {
        const node = nodesByIdRef.current.get(id);
        const from = currentEntrance.from[id];
        if (!node || !from) continue;
        node.x = from.x + (target.x - from.x) * eased;
        node.y = from.y + (target.y - from.y) * eased;
      }
      const positions = readPositions();
      positionsRef.current = positions;
      frameRef.current(positions);
      if (progress < 1) {
        currentEntrance.frameId = window.requestAnimationFrame(step);
        return;
      }
      savedLayoutEntranceRef.current = null;
      initializedRef.current(positions);
    };
    entrance.frameId = window.requestAnimationFrame(step);
  };

  const initializeSimulation = (
    useOverrides = true,
    carriedPositions: GraphNodePositions = {},
  ) => {
    simulationRef.current?.stop();
    stopSavedLayoutEntrance();
    savedLayoutEntranceRef.current = null;
    const initialPositions = useOverrides
      ? { ...carriedPositions, ...overridesRef.current }
      : {};
    const nodes = createGraphForceNodes(graphRef.current.nodes.map((node) => ({
      ...node,
      ...(useOverrides ? initialPositions[node.id] : null),
    })));
    const hasCompleteLayout = useOverrides && nodes.every((node) => (
      initialPositions[node.id] !== undefined
    ));
    const anchoredNodes = useOverrides
      ? nodes.filter((node) => initialPositions[node.id] !== undefined)
      : [];
    const shouldAnimateSavedLayout = hasCompleteLayout
      && Object.keys(carriedPositions).length === 0;
    const savedLayoutTargets = shouldAnimateSavedLayout
      ? Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
      : null;
    if (nodes.length > 0 && (!hasCompleteLayout || shouldAnimateSavedLayout)) {
      const centerX = themeGraphTokens.viewBoxWidthPx / 2;
      const centerY = themeGraphTokens.viewBoxHeightPx / 2;
      for (const node of nodes) {
        if (!hasCompleteLayout && initialPositions[node.id] !== undefined) continue;
        node.x = centerX + (node.x - centerX) * themeGraphTokens.forceInitialSpreadRatio;
        node.y = centerY + (node.y - centerY) * themeGraphTokens.forceInitialSpreadRatio;
      }
    }
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
    initialSimulationPendingRef.current = !hasCompleteLayout;
    releasedDragIdRef.current = null;
    releaseDiagnosticRef.current = null;
    simulation.on('tick', () => {
      const positions = readPositions();
      positionsRef.current = positions;
      frameRef.current(positions);
    });
    simulation.on('end', () => {
      if (dragRef.current) return;
      const wasInitialSimulation = initialSimulationPendingRef.current;
      initialSimulationPendingRef.current = false;
      for (const node of anchoredNodes) {
        node.fx = null;
        node.fy = null;
      }
      const positions = readPositions();
      positionsRef.current = positions;
      frameRef.current(positions);
      const releaseDiagnostic = releaseDiagnosticRef.current;
      if (releaseDiagnostic) {
        finishGraphForceReleaseDiagnostic(releaseDiagnostic, positions);
        releaseDiagnosticRef.current = null;
      }
      if (wasInitialSimulation) initializedRef.current(positions);
      commitRef.current(cloneGraphNodePositions(positions));
    });
    if (!hasCompleteLayout) {
      for (const node of anchoredNodes) {
        node.fx = node.x;
        node.fy = node.y;
      }
    }
    const positions = readPositions();
    positionsRef.current = positions;
    frameRef.current(positions);
    simulationRef.current = simulation;
    if (savedLayoutTargets) {
      savedLayoutEntranceRef.current = {
        frameId: null,
        from: cloneGraphNodePositions(positions),
        targets: savedLayoutTargets,
      };
      if (activeRef.current) startSavedLayoutEntrance();
    } else if (!hasCompleteLayout && activeRef.current) {
      simulation.alpha(1).restart();
    } else if (hasCompleteLayout) {
      initializedRef.current(positions);
    }
  };

  useLayoutEffect(() => {
    previousDragIdRef.current = null;
    movedDragIdRef.current = null;
    positionsRef.current = {};
    initializeSimulation(true, retainedPositionsRef.current);
  }, [graphKey]);

  useEffect(() => {
    if (savedLayoutEntranceRef.current) {
      if (args.active) startSavedLayoutEntrance();
      else stopSavedLayoutEntrance();
      return;
    }
    const simulation = simulationRef.current;
    if (!simulation || !initialSimulationPendingRef.current || dragRef.current) return;
    if (args.active) simulation.restart();
    else simulation.stop();
  }, [args.active]);

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
    stopSavedLayoutEntrance();
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
    setGraphNodePosition(retainedPositionsRef.current, id, position);
    draggedFrameRef.current(id, position);
    simulation
      .alpha(Math.max(simulation.alpha(), themeGraphTokens.forceDragAlpha))
      .alphaTarget(themeGraphTokens.forceDragAlphaTarget)
      .restart();
  };

  return { positionsRef, releaseDragPosition, updateDragPosition };
}
