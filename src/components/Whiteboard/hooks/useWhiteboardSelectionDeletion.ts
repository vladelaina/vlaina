import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { isEditableTarget } from '../model/whiteboardInteractions';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardStroke } from '../model/whiteboardModel';

interface WhiteboardSelectionDeletionOptions {
  active: boolean;
  selectedConnectorIds: string[];
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  setConnectors: Dispatch<SetStateAction<WhiteboardConnector[]>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  pushHistory: () => void;
}

export function useWhiteboardSelectionDeletion({
  active,
  pushHistory,
  selectedConnectorIds,
  selectedElementIds,
  selectedStrokeIds,
  setConnectors,
  setElements,
  setSelectedConnectorIds,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
}: WhiteboardSelectionDeletionOptions) {
  const deleteSelection = useCallback(() => {
    if (selectedConnectorIds.length === 0 && selectedElementIds.length === 0 && selectedStrokeIds.length === 0) return;
    pushHistory();
    if (selectedConnectorIds.length > 0) {
      const selectedIds = new Set(selectedConnectorIds);
      setConnectors((current) => current.filter((connector) => !selectedIds.has(connector.id)));
      setSelectedConnectorIds([]);
    }
    if (selectedElementIds.length > 0) {
      const selectedIds = new Set(selectedElementIds);
      setElements((current) => current.filter((element) => !selectedIds.has(element.id)));
      setConnectors((current) => current.filter((connector) => (
        !selectedIds.has(connector.fromId) && !selectedIds.has(connector.toId)
      )));
      setSelectedElementIds([]);
    }
    if (selectedStrokeIds.length > 0) {
      const selectedIds = new Set(selectedStrokeIds);
      setStrokes((current) => current.filter((stroke) => !selectedIds.has(stroke.id)));
      setSelectedStrokeIds([]);
    }
  }, [
    pushHistory, selectedConnectorIds, selectedElementIds, selectedStrokeIds, setConnectors, setElements,
    setSelectedConnectorIds, setSelectedElementIds, setSelectedStrokeIds, setStrokes,
  ]);

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || (event.key !== 'Backspace' && event.key !== 'Delete')) return;
      event.preventDefault();
      deleteSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, deleteSelection]);

  return deleteSelection;
}
