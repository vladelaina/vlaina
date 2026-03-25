import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage } from '@/lib/ai/types';
import { createPersistenceQueue, type PersistenceQueue } from './persistenceEngine';
import { getStorageBasePath } from './basePath';

const sessionQueues = new Map<string, PersistenceQueue<string>>();
const DEFAULT_DEBOUNCE_MS = 180;

function getSessionQueue(sessionId: string): PersistenceQueue<string> {
  const existing = sessionQueues.get(sessionId);
  if (existing) return existing;

  let queue: PersistenceQueue<string>;
  queue = createPersistenceQueue<string>({
    debounceMs: DEFAULT_DEBOUNCE_MS,
    write: async (payload) => {
      await writeSessionJsonRaw(sessionId, payload);
    },
    onError: (error) => {
      console.error('[chatStorage] save session failed:', error);
    },
    onIdle: () => {
      if (sessionQueues.get(sessionId) === queue) {
        sessionQueues.delete(sessionId);
      }
    },
  });

  sessionQueues.set(sessionId, queue);
  return queue;
}

async function writeSessionJsonRaw(sessionId: string, payload: string) {
  const storage = getStorageAdapter();
  const base = await getStorageBasePath();
  const chatRoot = await joinPath(base, '.vlaina', 'chat');
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

export async function saveSessionJson(sessionId: string, messages: ChatMessage[]) {
  const payload = JSON.stringify(messages, null, 2);
  await getSessionQueue(sessionId).saveNow(payload);
}

export function scheduleSessionJsonSave(
  sessionId: string,
  messages: ChatMessage[],
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  const payload = JSON.stringify(messages, null, 2);
  getSessionQueue(sessionId).schedule(payload, { debounceMs });
}

export function cancelSessionJsonSave(sessionId: string) {
  const queue = sessionQueues.get(sessionId);
  if (!queue) return;
  queue.cancel();
  if (!queue.hasPending()) {
    sessionQueues.delete(sessionId);
  }
}

export async function flushPendingSessionJsonSaves(): Promise<void> {
  const queues = Array.from(sessionQueues.values());
  if (queues.length === 0) return;
  const results = await Promise.allSettled(queues.map((queue) => queue.flush()));
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);

  if (errors.length > 0) {
    if (errors.length === 1 && errors[0] instanceof Error) {
      throw errors[0];
    }
    console.error('[chatStorage] Failed to flush one or more chat session saves:', errors);
    throw new Error(`Failed to flush chat session saves (${errors.length} errors)`);
  }
}

export async function deleteSessionJson(sessionId: string): Promise<void> {
  const queue = sessionQueues.get(sessionId);
  if (queue) {
    queue.cancel();
    await queue.flush();
    sessionQueues.delete(sessionId);
  }

  const storage = getStorageAdapter();
  const base = await getStorageBasePath();
  const path = await joinPath(base, '.vlaina', 'chat', 'sessions', `${sessionId}.json`);
  if (await storage.exists(path)) {
    await storage.deleteFile(path);
  }
}

export async function loadSessionJson(sessionId: string): Promise<ChatMessage[] | null> {
  const storage = getStorageAdapter();
  const base = await getStorageBasePath();
  const path = await joinPath(base, '.vlaina', 'chat', 'sessions', `${sessionId}.json`);
  
  if (await storage.exists(path)) {
      try {
          const content = await storage.readFile(path);
          return JSON.parse(content);
      } catch (error) {
          console.error('[chatStorage] Failed to load session file:', path, error);
          return null;
      }
  }
  return null;
}
