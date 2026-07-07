import { desktopWindow } from '@/lib/desktop/window';
import {
  MAX_NOTES_ROOT_BROADCAST_LABEL_CHARS,
  MAX_NOTES_ROOT_BROADCAST_REQUEST_ID_CHARS,
  MAX_NOTES_ROOT_PATH_CHARS,
  MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES,
} from './notesRootStoreConstants';
import { normalizeSafeNotesRootPath } from './notesRootInfoUtils';

let windowNotesRootPath: string | null = null;
let windowLabel: string | null = null;
let notesRootChannel: BroadcastChannel | null = null;
const pendingQueries: Map<string, (label: string | null) => void> = new Map();

type NotesRootBroadcastMessage =
  | { type: 'query'; requestId: string; notesRootPath: string }
  | { type: 'response'; requestId: string; responseLabel: string | null };

function normalizeBroadcastString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

export function parseNotesRootBroadcastMessage(value: unknown): NotesRootBroadcastMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<Record<'type' | 'requestId' | 'notesRootPath' | 'responseLabel', unknown>>;
  const requestId = normalizeBroadcastString(data.requestId, MAX_NOTES_ROOT_BROADCAST_REQUEST_ID_CHARS);
  if (!requestId) {
    return null;
  }

  if (data.type === 'query') {
    const notesRootPath = normalizeBroadcastString(data.notesRootPath, MAX_NOTES_ROOT_PATH_CHARS);
    const normalizedNotesRootPath = notesRootPath ? normalizeSafeNotesRootPath(notesRootPath) : null;
    return normalizedNotesRootPath ? { type: 'query', requestId, notesRootPath: normalizedNotesRootPath } : null;
  }

  if (data.type === 'response') {
    if (data.responseLabel === null || data.responseLabel === undefined) {
      return { type: 'response', requestId, responseLabel: null };
    }
    const responseLabel = normalizeBroadcastString(data.responseLabel, MAX_NOTES_ROOT_BROADCAST_LABEL_CHARS);
    return responseLabel ? { type: 'response', requestId, responseLabel } : null;
  }

  return null;
}

export function setWindowNotesRootPath(path: string | null) {
  windowNotesRootPath = path;
}

export async function initializeWindowLabel(): Promise<void> {
  try {
    windowLabel = await desktopWindow.getLabel();
  } catch {
    windowLabel = null;
  }
}

export function setupBroadcastChannel() {
  if (notesRootChannel || typeof BroadcastChannel === 'undefined') return;

  try {
    notesRootChannel = new BroadcastChannel('vlaina-notes-root');
  } catch {
    notesRootChannel = null;
    return;
  }

  notesRootChannel.onmessage = (event) => {
    const message = parseNotesRootBroadcastMessage(event.data);
    if (!message) {
      return;
    }

    if (message.type === 'query' && windowNotesRootPath === message.notesRootPath && windowLabel) {
      try {
        notesRootChannel?.postMessage({
          type: 'response',
          requestId: message.requestId,
          responseLabel: windowLabel,
        });
      } catch {
      }
    } else if (message.type === 'response' && pendingQueries.has(message.requestId)) {
      const resolve = pendingQueries.get(message.requestId);
      pendingQueries.delete(message.requestId);
      resolve?.(message.responseLabel);
    }
  };
}

export async function queryNotesRootOpenInOtherWindow(path: string): Promise<string | null> {
  const normalizedPath = normalizeSafeNotesRootPath(path);
  if (!normalizedPath) {
    return null;
  }
  const requestId = `req-${crypto.randomUUID()}`;
  setupBroadcastChannel();
  if (pendingQueries.size >= MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES) {
    return null;
  }

  return new Promise((resolve) => {
    pendingQueries.set(requestId, resolve);

    try {
      notesRootChannel?.postMessage({
        type: 'query',
        requestId,
        notesRootPath: normalizedPath,
      });
    } catch {
    }

    setTimeout(() => {
      if (pendingQueries.has(requestId)) {
        pendingQueries.delete(requestId);
        resolve(null);
      }
    }, 150);
  });
}
