import { useCallback, useEffect, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { useUIStore } from '@/stores/uiSlice';
import { GraphCanvas } from './GraphCanvas';
import { layoutNoteGraph } from './model/graphLayout';
import { useGraphUIStore, type GraphNodePositions } from './store/useGraphUIStore';
import { useNoteGraphModel } from './hooks/useNoteGraphModel';
import { useGraphNoteScan } from './hooks/useGraphNoteScan';

const EMPTY_GRAPH_NODE_POSITIONS: GraphNodePositions = {};

interface GraphViewProps {
  active?: boolean;
  onStartupReady?: () => void;
  onPrimaryContentReady?: () => void;
}

export function GraphView({
  active = true,
  onStartupReady,
  onPrimaryContentReady,
}: GraphViewProps) {
  const { t } = useI18n();
  const openNote = useNotesStore((state) => state.openNote);
  const currentNotesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const setSelectedPath = useGraphUIStore((state) => state.setSelectedPath);
  const setNodePosition = useGraphUIStore((state) => state.setNodePosition);
  const setNodePositions = useGraphUIStore((state) => state.setNodePositions);
  const positionOverrides = useGraphUIStore((state) => (
    currentNotesRootPath
      ? state.nodePositionsByRoot[currentNotesRootPath] ?? EMPTY_GRAPH_NODE_POSITIONS
      : EMPTY_GRAPH_NODE_POSITIONS
  ));
  const loading = useGraphNoteScan({ onPrimaryContentReady, onStartupReady });

  const {
    fallbackFocusPath,
    focusPath,
    fullGraph,
    selectedPath,
    visibleGraph,
  } = useNoteGraphModel();
  const layout = useMemo(
    () => layoutNoteGraph(visibleGraph, focusPath),
    [focusPath, visibleGraph],
  );

  useEffect(() => {
    if (selectedPath && fullGraph.nodes.some((node) => node.id === selectedPath)) return;
    if (selectedPath === fallbackFocusPath) return;
    setSelectedPath(fallbackFocusPath);
  }, [fallbackFocusPath, fullGraph.nodes, selectedPath, setSelectedPath]);

  const handleOpenNode = useCallback(async (path: string) => {
    await openNote(path);
    setAppViewMode('notes');
  }, [openNote, setAppViewMode]);

  const handlePositionCommit = useCallback((path: string, position: { x: number; y: number }) => {
    if (!currentNotesRootPath) return;
    setNodePosition(currentNotesRootPath, path, position);
  }, [currentNotesRootPath, setNodePosition]);

  const handlePositionsCommit = useCallback((positions: GraphNodePositions) => {
    if (!currentNotesRootPath) return;
    const currentPositions = useGraphUIStore.getState().nodePositionsByRoot[currentNotesRootPath]
      ?? EMPTY_GRAPH_NODE_POSITIONS;
    setNodePositions(currentNotesRootPath, { ...currentPositions, ...positions });
  }, [currentNotesRootPath, setNodePositions]);

  return (
    <section
      aria-label={t('app.viewGraph')}
      data-graph-view-mode="true"
      data-graph-active={active ? 'true' : 'false'}
      className="relative h-full min-h-0 overflow-hidden bg-[var(--vlaina-color-graph-canvas)] text-[var(--vlaina-color-text-primary)]"
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--vlaina-color-text-muted)]">
          {t('graph.loading')}
        </div>
      ) : layout.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-[var(--vlaina-color-text-muted)]">
          {t('graph.empty')}
        </div>
      ) : (
        <GraphCanvas
          active={active}
          graph={layout}
          positionOverrides={positionOverrides}
          selectedPath={focusPath}
          onSelectPath={setSelectedPath}
          onOpenPath={(path) => void handleOpenNode(path)}
          onPositionCommit={handlePositionCommit}
          onPositionsCommit={handlePositionsCommit}
        />
      )}
    </section>
  );
}
