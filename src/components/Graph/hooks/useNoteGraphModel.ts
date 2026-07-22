import { useMemo, useRef } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { FileTreeNode } from '@/stores/notes/types';
import { filterNoteGraph } from '../model/graphFilters';
import { buildNoteGraph } from '../model/noteGraph';
import { useGraphUIStore } from '../store/useGraphUIStore';

const EMPTY_FILE_TREE: readonly FileTreeNode[] = [];
const EMPTY_NOTE_CONTENTS_CACHE = new Map();

export function useNoteGraphModel(active = true) {
  const rootFolder = useNotesStore((state) => active ? state.rootFolder : null);
  const currentNotePath = useNotesStore((state) => active ? state.currentNote?.path ?? null : null);
  const noteContentsCache = useNotesStore((state) => (
    active ? state.noteContentsCache : EMPTY_NOTE_CONTENTS_CACHE
  ));
  const noteContentsCacheRevision = useNotesStore((state) => (
    active ? state.noteContentsCacheRevision : 0
  ));
  const mode = useGraphUIStore((state) => active ? state.mode : 'all');
  const selectedPath = useGraphUIStore((state) => active ? state.selectedPath : null);
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

  const model = {
    fallbackFocusPath,
    focusPath,
    fullGraph,
    mode,
    selectedPath,
    visibleGraph,
  };
  const activeModelRef = useRef(model);
  if (active) {
    activeModelRef.current = model;
  }
  return activeModelRef.current;
}
