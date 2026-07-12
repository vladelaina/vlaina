import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { WhiteboardConnector } from '../model/whiteboardModel';

interface WhiteboardConnectorCreationOptions {
  connectorIdRef: MutableRefObject<number>;
  connectorSourceId: string | null;
  connectors: WhiteboardConnector[];
  pushHistory: () => void;
  setConnectorSourceId: Dispatch<SetStateAction<string | null>>;
  setConnectors: Dispatch<SetStateAction<WhiteboardConnector[]>>;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
}

export function useWhiteboardConnectorCreation({
  connectorIdRef,
  connectorSourceId,
  connectors,
  pushHistory,
  setConnectorSourceId,
  setConnectors,
  setSelectedConnectorIds,
  setSelectedElementId,
  setSelectedStrokeIds,
}: WhiteboardConnectorCreationOptions) {
  return useCallback((id: string) => {
    setSelectedConnectorIds([]);
    setSelectedElementId(id);
    setSelectedStrokeIds([]);
    if (!connectorSourceId) {
      setConnectorSourceId(id);
      return;
    }
    const sourceId = connectorSourceId;
    setConnectorSourceId(null);
    if (
      sourceId === id ||
      connectors.some((connector) => connector.fromId === sourceId && connector.toId === id)
    ) return;
    pushHistory();
    const connectorId = `wb-connector-${connectorIdRef.current}`;
    connectorIdRef.current += 1;
    setConnectors((current) => (
      current.some((connector) => connector.fromId === sourceId && connector.toId === id)
        ? current
        : [...current, { id: connectorId, fromId: sourceId, toId: id }]
    ));
  }, [
    connectorIdRef, connectorSourceId, connectors, pushHistory, setConnectorSourceId,
    setConnectors, setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds,
  ]);
}
