import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { ensureSystemDirectory, getVaultSystemStorePath } from '../systemStoragePaths';

export interface NotesExternalPathRenameEvent {
  type: 'rename';
  sourceId: string;
  nonce: string;
  stamp: number;
  notesPath: string;
  oldPath: string;
  newPath: string;
}

const CHANNEL_NAME = 'vlaina-notes-external-path';
const STORAGE_KEY = 'vlaina-notes-external-path-event';
const EVENT_FILE_NAME = 'external-path-events.json';
const MAX_STORED_EVENTS = 20;

const sourceId = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

const listeners = new Set<(event: NotesExternalPathRenameEvent) => void>();
let channel: BroadcastChannel | null = null;
let storageListenerBound = false;

function parseRenameEvent(value: unknown): NotesExternalPathRenameEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<NotesExternalPathRenameEvent>;
  if (
    event.type !== 'rename' ||
    typeof event.sourceId !== 'string' ||
    typeof event.nonce !== 'string' ||
    typeof event.stamp !== 'number' ||
    typeof event.notesPath !== 'string' ||
    typeof event.oldPath !== 'string' ||
    typeof event.newPath !== 'string'
  ) {
    return null;
  }

  return {
    type: 'rename',
    sourceId: event.sourceId,
    nonce: event.nonce,
    stamp: event.stamp,
    notesPath: event.notesPath,
    oldPath: event.oldPath,
    newPath: event.newPath,
  };
}

function notifyListeners(event: NotesExternalPathRenameEvent) {
  if (event.sourceId === sourceId) {
    return;
  }

  listeners.forEach((listener) => {
    listener(event);
  });
}

function ensureBroadcastChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') {
    return;
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (message) => {
    const event = parseRenameEvent(message.data);
    if (event) {
      notifyListeners(event);
    }
  };
}

function ensureStorageListener() {
  if (storageListenerBound || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      const parsed = parseRenameEvent(JSON.parse(event.newValue));
      if (parsed) {
        notifyListeners(parsed);
      }
    } catch {
    }
  });
  storageListenerBound = true;
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

  const event: NotesExternalPathRenameEvent = {
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
  };

  ensureBroadcastChannel();
  channel?.postMessage(event);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
  }

  void appendNotesExternalPathEvent(event);
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

    listener({
      nonce: event.nonce,
      oldPath: event.oldPath,
      newPath: event.newPath,
    });
  };

  listeners.add(wrappedListener);

  return () => {
    listeners.delete(wrappedListener);
  };
}

export function getNotesExternalPathEventsRelativePath() {
  return `__vlaina_system__/${EVENT_FILE_NAME}`;
}

export async function readNotesExternalPathEvents(
  notesPath: string,
  options?: { afterStamp?: number }
) {
  const normalizedNotesPath = normalizeNotePathKey(notesPath);
  if (!normalizedNotesPath) {
    return [];
  }

  const storage = getStorageAdapter();
  const eventPath = await getNotesExternalPathEventsPath(normalizedNotesPath);
  const content = await storage.readFile(eventPath).catch(() => null);
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
  return getVaultSystemStorePath(notesPath, EVENT_FILE_NAME);
}

async function appendNotesExternalPathEvent(event: NotesExternalPathRenameEvent) {
  try {
    const storage = getStorageAdapter();
    const eventPath = await getNotesExternalPathEventsPath(event.notesPath);
    await ensureSystemDirectory(await getVaultSystemStorePath(event.notesPath));
    const previousEvents = await readStoredEvents(eventPath);
    const nextEvents = [...previousEvents, event].slice(-MAX_STORED_EVENTS);
    await storage.writeFile(eventPath, JSON.stringify(nextEvents), { recursive: true });
  } catch {
  }
}

async function readStoredEvents(eventPath: string) {
  const storage = getStorageAdapter();
  const content = await storage.readFile(eventPath).catch(() => null);
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => parseRenameEvent(entry))
          .filter((event): event is NotesExternalPathRenameEvent => Boolean(event))
      : [];
  } catch {
    return [];
  }
}
