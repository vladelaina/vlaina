import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage } from '@/lib/ai/types';
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript';
import { createPersistenceQueue, type PersistenceQueue } from './persistenceEngine';
import { getStorageBasePath } from './basePath';
import { isSafeChatSessionId } from './unifiedStorageAI';

const sessionQueues = new Map<string, PersistenceQueue<ChatMessage[]>>();
const DEFAULT_DEBOUNCE_MS = 180;
let autoSyncTrigger: ((sessionId?: string) => void) | null = null;

export function setChatStorageAutoSyncTrigger(
  trigger: ((sessionId?: string) => void) | null,
): void {
  autoSyncTrigger = trigger;
}

function serializeSessionMessages(messages: ChatMessage[]): string {
  return JSON.stringify(messages);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeMessageVersion(
  value: unknown,
  fallbackContent: string,
): ChatMessage['versions'][number] {
  if (!isRecord(value)) {
    return {
      content: fallbackContent,
      createdAt: Date.now(),
      subsequentMessages: [],
    };
  }

  const content = typeof value.content === 'string' ? value.content : fallbackContent;
  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
  const subsequentMessages = Array.isArray(value.subsequentMessages)
    ? normalizeSessionMessages(value.subsequentMessages)
    : [];
  const apiTranscript = normalizeApiTranscriptMessages(value.apiTranscript);
  return {
    content,
    createdAt,
    subsequentMessages,
    ...(apiTranscript ? { apiTranscript } : {}),
  };
}

function normalizeSessionMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'system') {
    return null;
  }

  const now = Date.now();
  const content = typeof value.content === 'string' ? value.content : '';
  const timestamp = typeof value.timestamp === 'number' ? value.timestamp : now;
  const versions = Array.isArray(value.versions)
    ? value.versions.map((version) => normalizeMessageVersion(version, content))
    : [];
  const normalizedVersions = versions.length > 0
    ? versions
    : [{
        content,
        createdAt: timestamp,
        subsequentMessages: [],
      }];
  const rawCurrentVersionIndex = typeof value.currentVersionIndex === 'number'
    ? Math.floor(value.currentVersionIndex)
    : 0;
  const currentVersionIndex =
    rawCurrentVersionIndex >= 0 && rawCurrentVersionIndex < normalizedVersions.length
      ? rawCurrentVersionIndex
      : 0;
  const apiTranscript = normalizeApiTranscriptMessages(value.apiTranscript)
    ?? normalizedVersions[currentVersionIndex]?.apiTranscript;

  if (apiTranscript && !normalizedVersions[currentVersionIndex]?.apiTranscript) {
    normalizedVersions[currentVersionIndex] = {
      ...normalizedVersions[currentVersionIndex],
      apiTranscript,
    };
  }

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `msg-${crypto.randomUUID()}`,
    role,
    content,
    ...(apiTranscript ? { apiTranscript } : {}),
    ...(Array.isArray(value.imageSources) ? { imageSources: value.imageSources.filter((item): item is string => typeof item === 'string') } : {}),
    modelId: typeof value.modelId === 'string' ? value.modelId : '',
    timestamp,
    versions: normalizedVersions,
    currentVersionIndex,
  };
}

export function normalizeSessionMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeSessionMessage)
    .filter((message): message is ChatMessage => message !== null);
}

function assertSafeChatSessionId(sessionId: string): void {
  if (!isSafeChatSessionId(sessionId)) {
    throw new Error(`Unsafe chat session id: ${sessionId}`);
  }
}

function getSessionQueue(sessionId: string): PersistenceQueue<ChatMessage[]> {
  assertSafeChatSessionId(sessionId);
  const existing = sessionQueues.get(sessionId);
  if (existing) return existing;

  let queue: PersistenceQueue<ChatMessage[]>;
  queue = createPersistenceQueue<ChatMessage[]>({
    debounceMs: DEFAULT_DEBOUNCE_MS,
    write: async (messages) => {
      await writeSessionJsonRaw(sessionId, serializeSessionMessages(messages));
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
  assertSafeChatSessionId(sessionId);
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
  autoSyncTrigger?.(sessionId);
}

export async function saveSessionJson(sessionId: string, messages: ChatMessage[]) {
  assertSafeChatSessionId(sessionId);
  await getSessionQueue(sessionId).saveNow(messages);
}

export function scheduleSessionJsonSave(
  sessionId: string,
  messages: ChatMessage[],
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  assertSafeChatSessionId(sessionId);
  getSessionQueue(sessionId).schedule(messages, { debounceMs });
}

export function cancelSessionJsonSave(sessionId: string) {
  assertSafeChatSessionId(sessionId);
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
  assertSafeChatSessionId(sessionId);
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
    autoSyncTrigger?.(sessionId);
  }
}

export async function loadSessionJson(sessionId: string): Promise<ChatMessage[] | null> {
  assertSafeChatSessionId(sessionId);
  const storage = getStorageAdapter();
  const base = await getStorageBasePath();
  const path = await joinPath(base, '.vlaina', 'chat', 'sessions', `${sessionId}.json`);
  
  if (await storage.exists(path)) {
      try {
          const content = await storage.readFile(path);
          const parsed: unknown = JSON.parse(content);
          if (!Array.isArray(parsed)) return null;
          return normalizeSessionMessages(parsed);
      } catch (error) {
          console.error('[chatStorage] Failed to load session file:', path, error);
          return null;
      }
  }
  return null;
}
