import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const GRAPH_UI_STORAGE_KEY = 'vlaina-graph-ui';

export type GraphMode = 'all' | 'local';

export interface GraphNodePosition {
  x: number;
  y: number;
}

export type GraphNodePositions = Record<string, GraphNodePosition>;

interface GraphUIStore {
  mode: GraphMode;
  nodePositionsByRoot: Record<string, GraphNodePositions>;
  searchQuery: string;
  selectedPath: string | null;
  clearNodePositions: (notesRootPath: string) => void;
  setMode: (mode: GraphMode) => void;
  setNodePosition: (
    notesRootPath: string,
    notePath: string,
    position: GraphNodePosition,
  ) => void;
  setNodePositions: (notesRootPath: string, positions: GraphNodePositions) => void;
  setSearchQuery: (query: string) => void;
  setSelectedPath: (path: string | null) => void;
}

function mergePersistedPositions(persistedState: unknown, currentState: GraphUIStore): GraphUIStore {
  const persisted = persistedState as Partial<Pick<GraphUIStore, 'nodePositionsByRoot'>> | null;
  return {
    ...currentState,
    nodePositionsByRoot: persisted?.nodePositionsByRoot ?? {},
  };
}

export const useGraphUIStore = create<GraphUIStore>()(persist(
  (set) => ({
    mode: 'all',
    nodePositionsByRoot: {},
    searchQuery: '',
    selectedPath: null,
    clearNodePositions: (notesRootPath) => set((state) => {
      if (!state.nodePositionsByRoot[notesRootPath]) return state;
      const { [notesRootPath]: _removed, ...remaining } = state.nodePositionsByRoot;
      return { nodePositionsByRoot: remaining };
    }),
    setMode: (mode) => set((state) => state.mode === mode ? state : { mode }),
    setNodePosition: (notesRootPath, notePath, position) => set((state) => {
      const currentPosition = state.nodePositionsByRoot[notesRootPath]?.[notePath];
      if (currentPosition?.x === position.x && currentPosition.y === position.y) return state;
      return {
        nodePositionsByRoot: {
          ...state.nodePositionsByRoot,
          [notesRootPath]: {
            ...state.nodePositionsByRoot[notesRootPath],
            [notePath]: position,
          },
        },
      };
    }),
    setNodePositions: (notesRootPath, positions) => set((state) => ({
      nodePositionsByRoot: {
        ...state.nodePositionsByRoot,
        [notesRootPath]: positions,
      },
    })),
    setSearchQuery: (searchQuery) => set((state) => (
      state.searchQuery === searchQuery ? state : { searchQuery }
    )),
    setSelectedPath: (selectedPath) => set((state) => (
      state.selectedPath === selectedPath ? state : { selectedPath }
    )),
  }),
  {
    merge: mergePersistedPositions,
    name: GRAPH_UI_STORAGE_KEY,
    partialize: (state) => ({ nodePositionsByRoot: state.nodePositionsByRoot }),
    storage: createJSONStorage(() => localStorage),
  },
));
