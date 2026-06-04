import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage } from '@/lib/ai/types';
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript';
import { normalizeRenderableImageSrc } from '@/lib/markdown/renderableImagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { createPersistenceQueue, type PersistenceQueue } from './persistenceEngine';
import { getStorageBasePath } from './basePath';
import { isSafeChatSessionId } from './unifiedStorageAI';

const sessionQueues = new Map<string, PersistenceQueue<ChatMessage[]>>();
const DEFAULT_DEBOUNCE_MS = 180;
const SESSION_MESSAGES_FILE_VERSION = 1;
let autoSyncTrigger: ((sessionId?: string) => void) | null = null;
let autoSyncTriggerRegistrationId = 0;

interface SessionMessagesFile {
  version: typeof SESSION_MESSAGES_FILE_VERSION;
  sessionId: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export function setChatStorageAutoSyncTrigger(
  trigger: ((sessionId?: string) => void) | null,
): void {
  autoSyncTriggerRegistrationId += 1;
  autoSyncTrigger = trigger;
}

export function registerChatStorageAutoSyncTrigger(
  trigger: (sessionId?: string) => void,
): () => void {
  const registrationId = autoSyncTriggerRegistrationId + 1;
  autoSyncTriggerRegistrationId = registrationId;
  autoSyncTrigger = trigger;

  return () => {
    if (autoSyncTriggerRegistrationId !== registrationId) {
      return;
    }
    autoSyncTriggerRegistrationId += 1;
    autoSyncTrigger = null;
  };
}

export function serializeSessionMessages(sessionId: string, messages: ChatMessage[]): string {
  assertSafeChatSessionId(sessionId);
  const payload: SessionMessagesFile = {
    version: SESSION_MESSAGES_FILE_VERSION,
    sessionId,
    updatedAt: Date.now(),
    messages: normalizeSessionMessages(messages),
  };
  return JSON.stringify(payload, null, 2);
}

function collectMessageIds(messages: ChatMessage[], ids = new Set<string>()): Set<string> {
  for (const message of messages) {
    ids.add(message.id);
    for (const version of message.versions || []) {
      collectMessageIds(version.subsequentMessages || [], ids);
    }
  }

  return ids;
}

export function preserveUnknownPersistedMessages(
  incomingMessages: ChatMessage[],
  persistedMessages: ChatMessage[] | null,
): ChatMessage[] {
  return mergeSessionMessages(incomingMessages, persistedMessages, {
    preferredSource: 'incoming',
  });
}

function serializeVersionForComparison(version: ChatMessage['versions'][number]): string {
  return JSON.stringify(version);
}

function createVersionFromMessage(message: ChatMessage): ChatMessage['versions'][number] {
  return {
    content: message.content || '',
    createdAt: message.timestamp || Date.now(),
    kind: 'original',
    subsequentMessages: [],
    ...(message.apiTranscript ? { apiTranscript: message.apiTranscript } : {}),
  };
}

function getNormalizedMessageVersions(message: ChatMessage): ChatMessage['versions'] {
  return Array.isArray(message.versions) && message.versions.length > 0
    ? message.versions
    : [createVersionFromMessage(message)];
}

function mergeMatchingMessages(preferred: ChatMessage): ChatMessage {
  const versions = getNormalizedMessageVersions(preferred);
  const preferredVersion = createVersionFromMessage(preferred);
  const preferredVersionIndex = versions.findIndex(
    (version) => serializeVersionForComparison(version) === serializeVersionForComparison(preferredVersion)
  );

  return {
    ...preferred,
    versions,
    currentVersionIndex: preferredVersionIndex >= 0
      ? preferredVersionIndex
      : Math.min(Math.max(preferred.currentVersionIndex ?? 0, 0), Math.max(versions.length - 1, 0)),
  };
}

export function mergeSessionMessages(
  incomingMessages: ChatMessage[],
  persistedMessages: ChatMessage[] | null,
  options: { preferredSource: 'incoming' | 'persisted' } = { preferredSource: 'incoming' },
): ChatMessage[] {
  if (!persistedMessages || persistedMessages.length === 0) {
    return incomingMessages;
  }

  const incomingById = new Map(incomingMessages.map((message) => [message.id, message]));
  const persistedById = new Map(persistedMessages.map((message) => [message.id, message]));
  const incomingIds = collectMessageIds(incomingMessages);
  const mergedById = new Map<string, ChatMessage>();

  for (const incoming of incomingMessages) {
    const persisted = persistedById.get(incoming.id);
    mergedById.set(
      incoming.id,
      persisted
        ? mergeMatchingMessages(options.preferredSource === 'persisted' ? persisted : incoming)
        : incoming
    );
  }

  for (const persisted of persistedMessages) {
    if (incomingIds.has(persisted.id)) {
      continue;
    }
    if (mergedById.has(persisted.id)) {
      continue;
    }
    const incoming = incomingById.get(persisted.id);
    if (incoming) {
      continue;
    }
    mergedById.set(persisted.id, persisted);
  }

  return [...mergedById.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeMessageVersion(
  value: unknown,
  fallbackContent: string,
): ChatMessage['versions'][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const content = typeof value.content === 'string' ? value.content : fallbackContent;
  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
  const kind = value.kind;
  if (kind !== 'regeneration' && kind !== 'edit' && kind !== 'original') {
    return null;
  }
  const subsequentMessages = Array.isArray(value.subsequentMessages)
    ? normalizeSessionMessages(value.subsequentMessages)
    : [];
  const apiTranscript = normalizeApiTranscriptMessages(value.apiTranscript);
  return {
    content,
    createdAt,
    kind,
    subsequentMessages,
    ...(apiTranscript ? { apiTranscript } : {}),
  };
}

function canRoleUseVersionKind(
  role: ChatMessage['role'],
  kind: ChatMessage['versions'][number]['kind'],
): boolean {
  if (role === 'assistant') {
    return kind === 'original' || kind === 'regeneration';
  }
  if (role === 'user') {
    return kind === 'original' || kind === 'edit';
  }
  return kind === 'original';
}

function normalizePersistedImageSources(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sources = value
    .map((item) => typeof item === 'string' ? normalizeRenderableImageSrc(item) : null)
    .filter((item): item is string => Boolean(item) && !parseVideoUrl(item));

  return sources.length > 0 ? sources : undefined;
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
    ? value.versions
        .map((version) => normalizeMessageVersion(version, content))
        .filter((version): version is ChatMessage['versions'][number] =>
          version !== null && canRoleUseVersionKind(role, version.kind)
        )
    : [];
  const normalizedVersions: ChatMessage['versions'] = versions.length > 0
    ? versions
    : [{
        content,
        createdAt: timestamp,
        kind: 'original',
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
  const imageSources = normalizePersistedImageSources(value.imageSources);

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `msg-${crypto.randomUUID()}`,
    role,
    content,
    ...(apiTranscript ? { apiTranscript } : {}),
    ...(imageSources ? { imageSources } : {}),
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

export function parseSessionMessagesPayload(
  expectedSessionId: string,
  value: unknown,
): ChatMessage[] | null {
  assertSafeChatSessionId(expectedSessionId);
  if (!isRecord(value)) {
    return null;
  }

  if (value.version !== SESSION_MESSAGES_FILE_VERSION) {
    return null;
  }

  if (value.sessionId !== expectedSessionId) {
    return null;
  }

  if (!Array.isArray(value.messages)) {
    return null;
  }

  return normalizeSessionMessages(value.messages);
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
      await writeSessionJsonRaw(sessionId, messages);
    },
    onError: (_error) => {
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

async function writeSessionJsonRaw(sessionId: string, messages: ChatMessage[]) {
  assertSafeChatSessionId(sessionId);
  const storage = getStorageAdapter();
  const base = await getStorageBasePath();
  const chatRoot = await joinPath(base, '.vlaina', 'chat');
  const dir = await joinPath(chatRoot, 'sessions');
  const path = await joinPath(dir, `${sessionId}.json`);

  if (!(await storage.exists(chatRoot))) {
    await storage.mkdir(chatRoot, true);
  }
  if (!(await storage.exists(dir))) {
    await storage.mkdir(dir, true);
  }

  let messagesToWrite = messages;
  if (await storage.exists(path)) {
    try {
      const parsed: unknown = JSON.parse(await storage.readFile(path));
      const persistedMessages = parseSessionMessagesPayload(sessionId, parsed);
      if (!persistedMessages) {
        throw new Error('Invalid existing session file');
      }
      messagesToWrite = mergeSessionMessages(messages, persistedMessages, {
        preferredSource: 'incoming',
      });
    } catch (error) {
      throw error;
    }
  }

  await storage.writeFile(path, serializeSessionMessages(sessionId, messagesToWrite));
  autoSyncTrigger?.(sessionId);
}

async function getSessionJsonPath(sessionId: string): Promise<string> {
  assertSafeChatSessionId(sessionId);
  const base = await getStorageBasePath();
  return joinPath(base, '.vlaina', 'chat', 'sessions', `${sessionId}.json`);
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

export function hasPendingSessionJsonSave(sessionId: string): boolean {
  assertSafeChatSessionId(sessionId);
  return sessionQueues.get(sessionId)?.hasPending() ?? false;
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
  const path = await getSessionJsonPath(sessionId);
  if (await storage.exists(path)) {
    await storage.deleteFile(path);
    autoSyncTrigger?.(sessionId);
  }
}

export async function hasSessionJson(sessionId: string): Promise<boolean> {
  assertSafeChatSessionId(sessionId);
  const storage = getStorageAdapter();
  return storage.exists(await getSessionJsonPath(sessionId));
}

export async function loadSessionJson(sessionId: string): Promise<ChatMessage[] | null> {
  assertSafeChatSessionId(sessionId);
  const storage = getStorageAdapter();
  const path = await getSessionJsonPath(sessionId);
  
  if (await storage.exists(path)) {
      try {
          const content = await storage.readFile(path);
          const parsed: unknown = JSON.parse(content);
          return parseSessionMessagesPayload(sessionId, parsed);
      } catch (error) {
          return null;
      }
  }
  return null;
}
