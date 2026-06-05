import { isStorageAutoSyncKind, type StorageAutoSyncKind } from './syncContract';

export type { StorageAutoSyncKind } from './syncContract';

export interface StorageAutoSyncEvent {
  kind: StorageAutoSyncKind;
  sourceId: string;
  stamp: number;
  nonce: string;
  sessionId?: string;
}

const CHANNEL_NAME = 'vlaina-storage-sync';
const STORAGE_KEY = 'vlaina-storage-sync-event';
const MAX_STORAGE_AUTO_SYNC_EVENT_CHARS = 8 * 1024;

const sourceId = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

const listeners = new Set<(event: StorageAutoSyncEvent) => void>();
let broadcastChannel: BroadcastChannel | null = null;
let storageListenerBound = false;

function parseStorageAutoSyncEvent(value: unknown): StorageAutoSyncEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<StorageAutoSyncEvent>;
  const kind = String(event.kind);
  if (
    !isStorageAutoSyncKind(kind) ||
    typeof event.sourceId !== 'string' ||
    typeof event.stamp !== 'number' ||
    !Number.isFinite(event.stamp) ||
    typeof event.nonce !== 'string'
  ) {
    return null;
  }

  return {
    kind,
    sourceId: event.sourceId,
    stamp: event.stamp,
    nonce: event.nonce,
    sessionId: typeof event.sessionId === 'string' ? event.sessionId : undefined,
  };
}

function notifyListeners(event: StorageAutoSyncEvent) {
  if (event.sourceId === sourceId) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
    }
  });
}

function ensureBroadcastChannel() {
  if (broadcastChannel || typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (message) => {
      const event = parseStorageAutoSyncEvent(message.data);
      if (!event) {
        return;
      }

      notifyListeners(event);
    };
  } catch {
    broadcastChannel = null;
  }
}

function ensureStorageListener() {
  if (storageListenerBound || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }
    if (event.newValue.length > MAX_STORAGE_AUTO_SYNC_EVENT_CHARS) {
      return;
    }

    try {
      const parsed = parseStorageAutoSyncEvent(JSON.parse(event.newValue));
      if (!parsed) {
        return;
      }

      notifyListeners(parsed);
    } catch {
    }
  });
  storageListenerBound = true;
}

export function emitStorageAutoSyncEvent(input: {
  kind: StorageAutoSyncKind;
  sessionId?: string;
}) {
  const event: StorageAutoSyncEvent = {
    kind: input.kind,
    sourceId,
    stamp: Date.now(),
    nonce:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    sessionId: input.sessionId,
  };

  ensureBroadcastChannel();
  try {
    broadcastChannel?.postMessage(event);
  } catch {
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
  }
}

export function subscribeStorageAutoSync(
  listener: (event: StorageAutoSyncEvent) => void,
): () => void {
  ensureBroadcastChannel();
  ensureStorageListener();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
