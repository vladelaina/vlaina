import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage } from '@/lib/ai/types';

type PendingSessionSave = {
  timer: ReturnType<typeof setTimeout> | null;
  payload: string | null;
  writing: Promise<void> | null;
};

const pendingSessionSaves = new Map<string, PendingSessionSave>();
const DEFAULT_DEBOUNCE_MS = 180;

function getPendingSessionSave(sessionId: string): PendingSessionSave {
  const existing = pendingSessionSaves.get(sessionId);
  if (existing) return existing;

  const next: PendingSessionSave = {
    timer: null,
    payload: null,
    writing: null,
  };
  pendingSessionSaves.set(sessionId, next);
  return next;
}

function queueSessionPayload(sessionId: string, messages: ChatMessage[]) {
  const pending = getPendingSessionSave(sessionId);
  pending.payload = JSON.stringify(messages, null, 2);
  return pending;
}

async function writeSessionJsonRaw(sessionId: string, payload: string) {
  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const chatRoot = await joinPath(base, '.nekotick', 'chat');
  const dir = await joinPath(chatRoot, 'sessions');

  if (!(await storage.exists(chatRoot))) {
    await storage.mkdir(chatRoot, true);
  }
  if (!(await storage.exists(dir))) {
    await storage.mkdir(dir, true);
  }

  const path = await joinPath(dir, `${sessionId}.json`);
  await storage.writeFile(path, payload);
}

function enqueueSessionWrite(sessionId: string): Promise<void> {
  const pending = getPendingSessionSave(sessionId);
  if (pending.writing) {
    return pending.writing;
  }

  pending.writing = (async () => {
    while (pending.payload !== null) {
      const payload = pending.payload;
      pending.payload = null;
      await writeSessionJsonRaw(sessionId, payload);
    }
  })()
    .catch((error) => {
      console.error('[chatStorage] save session failed:', error);
    })
    .finally(() => {
      pending.writing = null;
      if (pending.payload !== null) {
        void enqueueSessionWrite(sessionId);
        return;
      }
      if (!pending.timer) {
        pendingSessionSaves.delete(sessionId);
      }
    });

  return pending.writing;
}

export async function saveSessionJson(sessionId: string, messages: ChatMessage[]) {
  const pending = queueSessionPayload(sessionId, messages);
  if (pending.timer) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }
  await enqueueSessionWrite(sessionId);
}

export function scheduleSessionJsonSave(
  sessionId: string,
  messages: ChatMessage[],
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  const pending = queueSessionPayload(sessionId, messages);
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  pending.timer = setTimeout(() => {
    pending.timer = null;
    void enqueueSessionWrite(sessionId);
  }, debounceMs);
}

export function cancelSessionJsonSave(sessionId: string) {
  const pending = pendingSessionSaves.get(sessionId);
  if (!pending) return;
  pending.payload = null;
  if (pending.timer) {
    clearTimeout(pending.timer);
  }
  if (!pending.writing) {
    pendingSessionSaves.delete(sessionId);
  }
}

export async function deleteSessionJson(sessionId: string): Promise<void> {
  const pending = pendingSessionSaves.get(sessionId);
  if (pending) {
    pending.payload = null;
    if (pending.timer) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
    if (pending.writing) {
      await pending.writing;
    }
    pendingSessionSaves.delete(sessionId);
  }

  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const path = await joinPath(base, '.nekotick', 'chat', 'sessions', `${sessionId}.json`);
  if (await storage.exists(path)) {
    await storage.deleteFile(path);
  }
}

export async function loadSessionJson(sessionId: string): Promise<ChatMessage[] | null> {
  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const path = await joinPath(base, '.nekotick', 'chat', 'sessions', `${sessionId}.json`);
  
  if (await storage.exists(path)) {
      try {
          const content = await storage.readFile(path);
          return JSON.parse(content);
      } catch (e) {
          return null;
      }
  }
  return null;
}
