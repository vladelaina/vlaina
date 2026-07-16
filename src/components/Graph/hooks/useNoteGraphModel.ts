import { useMemo } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { FileTreeNode } from '@/stores/notes/types';
import { filterNoteGraph } from '../model/graphFilters';
import { buildNoteGraph } from '../model/noteGraph';
import { useGraphUIStore } from '../store/useGraphUIStore';

const EMPTY_FILE_TREE: readonly FileTreeNode[] = [];

export function useNoteGraphModel() {
  const rootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const noteContentsCache = useNotesStore((state) => state.noteContentsCache);
  const noteContentsCacheRevision = useNotesStore((state) => state.noteContentsCacheRevision);
  const mode = useGraphUIStore((state) => state.mode);
  const selectedPath = useGraphUIStore((state) => state.selectedPath);
  const fullGraph = useMemo(
    () => buildNoteGraph(
      rootFolder?.children ?? EMPTY_FILE_TREE,
      noteContentsCache,
      noteContentsCacheRevision,
    ),
    [noteContentsCache, noteContentsCacheRevision, rootFolder],
  );
  const fallbackFocusPath = fullGraph.nodes.some((node) => node.id === currentNotePath)
    ? currentNotePath
    : fullGraph.nodes[0]?.id ?? null;
  const focusPath = fullGraph.nodes.some((node) => node.id === selectedPath)
    ? selectedPath
    : fallbackFocusPath;
  const visibleGraph = useMemo(() => filterNoteGraph(fullGraph, {
    scope: mode,
    focusNodeId: focusPath,
    localDepth: 1,
  }), [focusPath, fullGraph, mode]);

  return {
    fallbackFocusPath,
    focusPath,
    fullGraph,
    mode,
    selectedPath,
    visibleGraph,
  };
}
