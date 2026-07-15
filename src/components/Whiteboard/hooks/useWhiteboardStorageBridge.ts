import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { WHITEBOARD_SYSTEM_STORAGE_SCOPE } from '@/lib/storage/whiteboardStoragePaths';
import { getNextWhiteboardIdSequence } from '../model/whiteboardIds';
import type {
  WhiteboardElement,
  WhiteboardPaperStyle,
  WhiteboardStroke,
  WhiteboardViewport,
} from '../model/whiteboardModel';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

interface WhiteboardStorageBridgeOptions {
  active: boolean;
  appliedBoardKeyRef: MutableRefObject<string | null>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setPaper: Dispatch<SetStateAction<WhiteboardPaperStyle>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  setViewport: Dispatch<SetStateAction<WhiteboardViewport>>;
  strokeIdRef: MutableRefObject<number>;
}

export function useWhiteboardStorageBridge({
  active,
  appliedBoardKeyRef,
  setElements,
  setPaper,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  setViewport,
  strokeIdRef,
}: WhiteboardStorageBridgeOptions) {
  const notesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? WHITEBOARD_SYSTEM_STORAGE_SCOPE);
  const activeBoardId = useWhiteboardStore((state) => state.activeBoardId);
  const activeSnapshot = useWhiteboardStore((state) => state.activeSnapshot);
  const loadedNotesRootPath = useWhiteboardStore((state) => state.loadedNotesRootPath);
  const loadWhiteboards = useWhiteboardStore((state) => state.loadForNotesRoot);

  useEffect(() => {
    if (!active) return;
    void loadWhiteboards(notesRootPath).catch(() => undefined);
  }, [active, loadWhiteboards, notesRootPath]);

  useEffect(() => {
    const boardKey = activeBoardId && loadedNotesRootPath ? `${loadedNotesRootPath}\n${activeBoardId}` : null;
    if (loadedNotesRootPath !== notesRootPath || !activeSnapshot || !boardKey || appliedBoardKeyRef.current === boardKey) return;
    appliedBoardKeyRef.current = boardKey;
    setElements(activeSnapshot.elements);
    setPaper(activeSnapshot.paper ?? 'dots');
    setStrokes(activeSnapshot.strokes);
    setViewport(activeSnapshot.viewport);
    setSelectedElementIds([]);
    setSelectedStrokeIds([]);
    strokeIdRef.current = getNextWhiteboardIdSequence(activeSnapshot.strokes, 'wb-stroke-');
  }, [
    activeBoardId, activeSnapshot, appliedBoardKeyRef, loadedNotesRootPath, notesRootPath,
    setElements, setPaper, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
    setViewport, strokeIdRef,
  ]);
}
