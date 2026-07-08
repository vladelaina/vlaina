import { useEffect, useState } from 'react';
import {
  deserializeWhiteboardSnapshot,
  serializeWhiteboardSnapshot,
  type WhiteboardSnapshot,
} from '../model/whiteboardDocument';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

const WHITEBOARD_STORAGE_KEY = 'vlaina:whiteboard:v1';
const WHITEBOARD_PERSISTENCE_DELAY_MS = 250;
export const MAX_WHITEBOARD_LOCAL_STORAGE_WRITE_BYTES = 4 * 1024 * 1024;
const MAX_WHITEBOARD_LOCAL_STORAGE_READ_BYTES = 16 * 1024 * 1024;

const whiteboardStorageEncoder = new TextEncoder();

type IdleWindow = Window & {
  cancelIdleCallback?: (id: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

export type WhiteboardPersistResult =
  | { ok: true; byteLength: number }
  | { ok: false; byteLength: number; reason: 'storage-unavailable' | 'too-large' | 'write-failed' };

export function loadWhiteboardSnapshot(): Partial<WhiteboardSnapshot> {
  try {
    const rawSnapshot = window.localStorage.getItem(WHITEBOARD_STORAGE_KEY);
    if (rawSnapshot && getSerializedWhiteboardByteLength(rawSnapshot, MAX_WHITEBOARD_LOCAL_STORAGE_READ_BYTES) > MAX_WHITEBOARD_LOCAL_STORAGE_READ_BYTES) {
      return {};
    }
    return rawSnapshot ? deserializeWhiteboardSnapshot(rawSnapshot) ?? {} : {};
  } catch {
    return {};
  }
}

export function persistWhiteboardSnapshot(
  snapshot: WhiteboardSnapshot,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): WhiteboardPersistResult {
  const serialized = serializeWhiteboardSnapshot(snapshot);
  const byteLength = getSerializedWhiteboardByteLength(serialized, MAX_WHITEBOARD_LOCAL_STORAGE_WRITE_BYTES);
  if (byteLength > MAX_WHITEBOARD_LOCAL_STORAGE_WRITE_BYTES) return { byteLength, ok: false, reason: 'too-large' };
  if (!storage) return { byteLength, ok: false, reason: 'storage-unavailable' };
  try {
    storage.setItem(WHITEBOARD_STORAGE_KEY, serialized);
    return { byteLength, ok: true };
  } catch {
    return { byteLength, ok: false, reason: 'write-failed' };
  }
}

export function useWhiteboardPersistence(snapshot: WhiteboardSnapshot, paused = false): WhiteboardPersistResult | null {
  const [status, setStatus] = useState<WhiteboardPersistResult | null>(null);
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
        if (!cancelled) setStatus(result ?? persistWhiteboardSnapshot(snapshot));
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
  }, [paused, saveActiveSnapshot, setActiveSnapshotDraft, snapshot.connectors, snapshot.elements, snapshot.ruler, snapshot.strokes, snapshot.viewport]);

  return status;
}

function getSerializedWhiteboardByteLength(serialized: string, maxBytes: number): number {
  if (serialized.length <= Math.floor(maxBytes / 3)) return serialized.length;
  return whiteboardStorageEncoder.encode(serialized).length;
}
