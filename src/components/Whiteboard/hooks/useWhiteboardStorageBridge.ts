import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import type {
  WhiteboardConnector,
  WhiteboardElement,
  WhiteboardStroke,
  WhiteboardViewport,
} from '../model/whiteboardModel';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

interface WhiteboardStorageBridgeOptions {
  active: boolean;
  appliedBoardIdRef: MutableRefObject<string | null>;
  connectorIdRef: MutableRefObject<number>;
  setConnectorSourceId: Dispatch<SetStateAction<string | null>>;
  setConnectors: Dispatch<SetStateAction<WhiteboardConnector[]>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  setViewport: Dispatch<SetStateAction<WhiteboardViewport>>;
  strokeIdRef: MutableRefObject<number>;
}

export function useWhiteboardStorageBridge({
  active,
  appliedBoardIdRef,
  connectorIdRef,
  setConnectorSourceId,
  setConnectors,
  setElements,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  setViewport,
  strokeIdRef,
}: WhiteboardStorageBridgeOptions) {
  const notesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const activeBoardId = useWhiteboardStore((state) => state.activeBoardId);
  const activeSnapshot = useWhiteboardStore((state) => state.activeSnapshot);
  const loadWhiteboards = useWhiteboardStore((state) => state.loadForNotesRoot);

  useEffect(() => {
    if (!active) return;
    void loadWhiteboards(notesRootPath).catch(() => undefined);
  }, [active, loadWhiteboards, notesRootPath]);

  useEffect(() => {
    if (!activeSnapshot || !activeBoardId || appliedBoardIdRef.current === activeBoardId) return;
    appliedBoardIdRef.current = activeBoardId;
    setConnectors(activeSnapshot.connectors);
    setElements(activeSnapshot.elements);
    setStrokes(activeSnapshot.strokes);
    setViewport(activeSnapshot.viewport);
    setSelectedElementIds([]);
    setSelectedStrokeIds([]);
    setConnectorSourceId(null);
    strokeIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.strokes, 'wb-stroke-');
    connectorIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.connectors, 'wb-connector-');
  }, [
    activeBoardId, activeSnapshot, appliedBoardIdRef, connectorIdRef, setConnectorSourceId,
    setConnectors, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
    setViewport, strokeIdRef,
  ]);
}
