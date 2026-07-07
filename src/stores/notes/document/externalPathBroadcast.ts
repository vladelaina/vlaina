import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { ensureSystemDirectory, getNotesRootSystemStorePath } from '../systemStoragePaths';
import {
  MAX_EVENT_FILE_BYTES,
  parseRenameEvent,
  type NotesExternalPathRenameEvent,
} from './externalPathBroadcastParsing';
export type { NotesExternalPathRenameEvent } from './externalPathBroadcastParsing';

const CHANNEL_NAME = 'vlaina-notes-external-path';
const STORAGE_KEY = 'vlaina-notes-external-path-event';
const EVENT_FILE_NAME = 'events.json';
const MAX_STORED_EVENTS = 20;

const sourceId = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

const listeners = new Set<(event: NotesExternalPathRenameEvent) => void>();
let channel: BroadcastChannel | null = null;
let storageListener: ((event: StorageEvent) => void) | null = null;

function notifyListeners(event: NotesExternalPathRenameEvent) {
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
  if (channel || typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
    return;
  }

  channel.onmessage = (message) => {
    const event = parseRenameEvent(message.data);
    if (event) {
      notifyListeners(event);
    }
  };
}

function ensureStorageListener() {
  if (storageListener || typeof window === 'undefined') {
    return;
  }

  storageListener = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }
    if (event.newValue.length > MAX_EVENT_FILE_BYTES) {
      return;
    }

    try {
      const parsed = parseRenameEvent(JSON.parse(event.newValue));
      if (parsed) {
        notifyListeners(parsed);
      }
    } catch {
    }
  };
  window.addEventListener('storage', storageListener);
}

function releaseExternalPathListenersIfIdle() {
  if (listeners.size > 0) {
    return;
  }

  channel?.close();
  channel = null;

  if (storageListener && typeof window !== 'undefined') {
    window.removeEventListener('storage', storageListener);
    storageListener = null;
  }
}

export function emitNotesExternalPathRename(input: {
  notesPath: string;
  oldPath: string;
  newPath: string;
}) {
  const notesPath = normalizeNotePathKey(input.notesPath);
  if (!notesPath || input.oldPath === input.newPath) {
    return;
  }

  const event = parseRenameEvent({
    type: 'rename',
    sourceId,
    stamp: Date.now(),
    nonce:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    notesPath,
    oldPath: input.oldPath,
    newPath: input.newPath,
  });
  if (!event) {
    return;
  }

  ensureBroadcastChannel();
  try {
    channel?.postMessage(event);
  } catch {
  }
  releaseExternalPathListenersIfIdle();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
  }

  void appendNotesExternalPathEvent(event).catch(() => undefined);
}

export function subscribeNotesExternalPathRename(
  notesPath: string,
  listener: (event: { nonce: string; oldPath: string; newPath: string }) => void
): () => void {
  const normalizedNotesPath = normalizeNotePathKey(notesPath);
  if (!normalizedNotesPath) {
    return () => {};
  }

  ensureBroadcastChannel();
  ensureStorageListener();

  const wrappedListener = (event: NotesExternalPathRenameEvent) => {
    if (event.notesPath !== normalizedNotesPath) {
      return;
    }

    try {
      listener({
        nonce: event.nonce,
        oldPath: event.oldPath,
        newPath: event.newPath,
      });
    } catch {
    }
  };

  listeners.add(wrappedListener);

  return () => {
    listeners.delete(wrappedListener);
    releaseExternalPathListenersIfIdle();
  };
}

export async function readNotesExternalPathEvents(
  notesPath: string,
  options?: { afterStamp?: number }
) {
  const normalizedNotesPath = normalizeNotePathKey(notesPath);
  if (!normalizedNotesPath) {
    return [];
  }

  const eventPath = await getNotesExternalPathEventsPath(normalizedNotesPath);
  const content = await readEventFileContent(eventPath);
  if (!content) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .slice(-MAX_STORED_EVENTS)
    .map((entry) => parseRenameEvent(entry))
    .filter((event): event is NotesExternalPathRenameEvent => {
      if (!event) {
        return false;
      }

      if (event.sourceId === sourceId || event.notesPath !== normalizedNotesPath) {
        return false;
      }

      if (options?.afterStamp != null && event.stamp < options.afterStamp) {
        return false;
      }

      return true;
    });
}

async function getNotesExternalPathEventsPath(notesPath: string) {
  return getNotesRootSystemStorePath(notesPath, EVENT_FILE_NAME);
}

async function appendNotesExternalPathEvent(event: NotesExternalPathRenameEvent) {
  try {
    const storage = getStorageAdapter();
    const eventPath = await getNotesExternalPathEventsPath(event.notesPath);
    await ensureSystemDirectory(await getNotesRootSystemStorePath(event.notesPath));
    const previousEvents = await readStoredEvents(eventPath);
    const nextEvents = [...previousEvents, event].slice(-MAX_STORED_EVENTS);
    await storage.writeFile(eventPath, JSON.stringify(nextEvents), { recursive: true });
  } catch {
  }
}

async function readStoredEvents(eventPath: string) {
  const content = await readEventFileContent(eventPath);
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed)
      ? parsed
          .slice(-MAX_STORED_EVENTS)
          .map((entry) => parseRenameEvent(entry))
          .filter((event): event is NotesExternalPathRenameEvent => Boolean(event))
      : [];
  } catch {
    return [];
  }
}

async function readEventFileContent(eventPath: string) {
  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(eventPath).catch(() => null);
  if (!fileInfo) {
    return null;
  }

  if (
    fileInfo?.isDirectory === true ||
    fileInfo?.isFile === false ||
    (typeof fileInfo?.size === 'number' && (
      !Number.isFinite(fileInfo.size) ||
      fileInfo.size < 0 ||
      fileInfo.size > MAX_EVENT_FILE_BYTES
    ))
  ) {
    return null;
  }

  const content = await storage.readFile(eventPath, MAX_EVENT_FILE_BYTES).catch(() => null);
  return content && new TextEncoder().encode(content).length <= MAX_EVENT_FILE_BYTES ? content : null;
}
