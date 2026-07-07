import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { isEditableTarget, type WhiteboardDragState } from '../model/whiteboardInteractions';
import type { WhiteboardTool } from '../model/whiteboardModel';

interface WhiteboardEscapeKeyOptions {
  active: boolean;
  clearDraftStroke: () => void;
  setConnectorSourceId: Dispatch<SetStateAction<string | null>>;
  setDragState: Dispatch<SetStateAction<WhiteboardDragState | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setTool: Dispatch<SetStateAction<WhiteboardTool>>;
}

export function useWhiteboardEscapeKey({
  active,
  clearDraftStroke,
  setConnectorSourceId,
  setDragState,
  setSelectedElementId,
  setSelectedStrokeIds,
  setTool,
}: WhiteboardEscapeKeyOptions) {
  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditableTarget(event.target)) return;
      clearDraftStroke();
      setConnectorSourceId(null);
      setDragState(null);
      setSelectedElementId(null);
      setSelectedStrokeIds([]);
      setTool('select');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    active, clearDraftStroke, setConnectorSourceId, setDragState,
    setSelectedElementId, setSelectedStrokeIds, setTool,
  ]);
}
