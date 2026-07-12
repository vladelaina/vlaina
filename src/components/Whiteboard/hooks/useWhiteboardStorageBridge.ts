import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import { WHITEBOARD_DEFAULT_RULER_STATE, type WhiteboardRulerState } from './useWhiteboardRuler';
import type {
  WhiteboardConnector,
  WhiteboardElement,
  WhiteboardPaperStyle,
  WhiteboardStroke,
  WhiteboardViewport,
} from '../model/whiteboardModel';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

interface WhiteboardStorageBridgeOptions {
  active: boolean;
  appliedBoardIdRef: MutableRefObject<string | null>;
  connectorIdRef: MutableRefObject<number>;
  elementIdRef: MutableRefObject<number>;
  setConnectorSourceId: Dispatch<SetStateAction<string | null>>;
  setConnectors: Dispatch<SetStateAction<WhiteboardConnector[]>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setPaper: Dispatch<SetStateAction<WhiteboardPaperStyle>>;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setRuler: Dispatch<SetStateAction<WhiteboardRulerState>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  setViewport: Dispatch<SetStateAction<WhiteboardViewport>>;
  strokeIdRef: MutableRefObject<number>;
}

export function useWhiteboardStorageBridge({
  active,
  appliedBoardIdRef,
  connectorIdRef,
  elementIdRef,
  setConnectorSourceId,
  setConnectors,
  setElements,
  setPaper,
  setSelectedConnectorIds,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setRuler,
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
    setPaper(activeSnapshot.paper ?? 'dots');
    setRuler(activeSnapshot.ruler ?? WHITEBOARD_DEFAULT_RULER_STATE);
    setStrokes(activeSnapshot.strokes);
    setViewport(activeSnapshot.viewport);
    setSelectedConnectorIds([]);
    setSelectedElementIds([]);
    setSelectedStrokeIds([]);
    setConnectorSourceId(null);
    strokeIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.strokes, 'wb-stroke-');
    connectorIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.connectors, 'wb-connector-');
    elementIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.elements, 'wb-element-');
  }, [
    activeBoardId, activeSnapshot, appliedBoardIdRef, connectorIdRef, elementIdRef, setConnectorSourceId,
    setConnectors, setElements, setPaper, setRuler, setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
    setViewport, strokeIdRef,
  ]);
}
