import { useEffect, useState } from 'react';
import type { WhiteboardSnapshot } from '../model/whiteboardDocument';
import { useWhiteboardStore, type WhiteboardSaveResult } from '../stores/useWhiteboardStore';

const WHITEBOARD_PERSISTENCE_DELAY_MS = 250;

type IdleWindow = Window & {
  cancelIdleCallback?: (id: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

export function useWhiteboardPersistence(snapshot: WhiteboardSnapshot, paused = false): WhiteboardSaveResult | null {
  const [status, setStatus] = useState<WhiteboardSaveResult | null>(null);
  const saveActiveSnapshot = useWhiteboardStore((state) => state.saveActiveSnapshot);
  const setActiveSnapshotDraft = useWhiteboardStore((state) => state.setActiveSnapshotDraft);

  useEffect(() => {
    let idleId: number | null = null;
    let cancelled = false;
    const boardId = useWhiteboardStore.getState().activeBoardId;
    setActiveSnapshotDraft(snapshot);
    if (paused) return undefined;
    const persist = () => {
      void saveActiveSnapshot(snapshot, boardId).then((result) => {
        if (!cancelled) setStatus(result ?? { byteLength: 0, ok: false, reason: 'storage-unavailable' });
      });
    };
    const timeoutId = window.setTimeout(() => {
      const idleWindow = window as IdleWindow;
      if (!idleWindow.requestIdleCallback) {
        persist();
        return;
      }
      idleId = idleWindow.requestIdleCallback(persist, { timeout: WHITEBOARD_PERSISTENCE_DELAY_MS });
    }, WHITEBOARD_PERSISTENCE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (idleId !== null) (window as IdleWindow).cancelIdleCallback?.(idleId);
    };
  }, [paused, saveActiveSnapshot, setActiveSnapshotDraft, snapshot.connectors, snapshot.elements, snapshot.paper, snapshot.ruler, snapshot.strokes, snapshot.viewport]);

  return status;
}
