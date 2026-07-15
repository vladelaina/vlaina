import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { WHITEBOARD_SYSTEM_STORAGE_SCOPE } from '@/lib/storage/whiteboardStoragePaths';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import { WHITEBOARD_DEFAULT_RULER_STATE, type WhiteboardRulerState } from './useWhiteboardRuler';
import type {
  WhiteboardElement,
  WhiteboardPaperStyle,
  WhiteboardStroke,
  WhiteboardViewport,
} from '../model/whiteboardModel';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

interface WhiteboardStorageBridgeOptions {
  active: boolean;
  appliedBoardIdRef: MutableRefObject<string | null>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setPaper: Dispatch<SetStateAction<WhiteboardPaperStyle>>;
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
  setElements,
  setPaper,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setRuler,
  setStrokes,
  setViewport,
  strokeIdRef,
}: WhiteboardStorageBridgeOptions) {
  const notesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? WHITEBOARD_SYSTEM_STORAGE_SCOPE);
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
    setElements(activeSnapshot.elements);
    setPaper(activeSnapshot.paper ?? 'dots');
    setRuler(activeSnapshot.ruler ?? WHITEBOARD_DEFAULT_RULER_STATE);
    setStrokes(activeSnapshot.strokes);
    setViewport(activeSnapshot.viewport);
    setSelectedElementIds([]);
    setSelectedStrokeIds([]);
    strokeIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.strokes, 'wb-stroke-');
  }, [
    activeBoardId, activeSnapshot, appliedBoardIdRef,
    setElements, setPaper, setRuler, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
    setViewport, strokeIdRef,
  ]);
}
