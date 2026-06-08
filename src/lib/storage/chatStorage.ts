import { getStorageAdapter, joinPath } from './adapter';
import type { ApiTranscriptMessage, ChatMessage, ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript';
import { normalizeRenderableImageSrc } from '@/lib/markdown/renderableImagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { parseMarkdownAndHtmlImageTokens, parseMarkdownImageTokens } from '@/lib/markdown/markdownImageTokens';
import { createPersistenceQueue, type PersistenceQueue } from './persistenceEngine';
import { getStorageBasePath } from './basePath';
import { isSafeChatSessionId } from './unifiedStorageAI';

const sessionQueues = new Map<string, PersistenceQueue<ChatMessage[]>>();
const deletingSessionJsons = new Set<string>();
const deletedSessionJsons = new Set<string>();
const DEFAULT_DEBOUNCE_MS = 180;
const SESSION_MESSAGES_FILE_VERSION = 1;
const MAX_SESSION_MESSAGES_BYTES = 25 * 1024 * 1024;
const MAX_SESSION_MESSAGE_NODES = 10_000;
const MAX_SESSION_MESSAGE_VERSIONS = 20;
const MAX_SESSION_MESSAGE_BRANCH_MESSAGES = 100;
const MAX_SESSION_MESSAGE_BRANCH_DEPTH = 1;
const MAX_SESSION_IMAGE_SOURCE_ENTRIES = 2000;
const MAX_SESSION_IMAGE_SOURCES = 1000;
const MAX_SESSION_MESSAGE_ID_CHARS = 512;
const MAX_DELETED_SESSION_JSON_TOMBSTONES = 4096;
let autoSyncTrigger: ((sessionId?: string) => void) | null = null;
let autoSyncTriggerRegistrationId = 0;

function isSessionJsonDeleteBlocked(sessionId: string): boolean {
  return deletingSessionJsons.has(sessionId) || deletedSessionJsons.has(sessionId);
}

function rememberDeletedSessionJson(sessionId: string): void {
  deletedSessionJsons.delete(sessionId);
  deletedSessionJsons.add(sessionId);
  while (deletedSessionJsons.size > MAX_DELETED_SESSION_JSON_TOMBSTONES) {
    const oldest = deletedSessionJsons.values().next().value;
    if (typeof oldest !== 'string') break;
    deletedSessionJsons.delete(oldest);
  }
}

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

function collectMessageIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>();
  const stack: Array<{ depth: number; messages: ChatMessage[] }> = [{ depth: 0, messages }];
  let visited = 0;

  while (stack.length > 0 && visited < MAX_SESSION_MESSAGE_NODES) {
    const frame = stack.pop()!;
    for (const message of frame.messages) {
      if (visited >= MAX_SESSION_MESSAGE_NODES) {
        break;
      }
      visited += 1;
      ids.add(message.id);

      if (frame.depth >= MAX_SESSION_MESSAGE_BRANCH_DEPTH) {
        continue;
      }

      for (const version of (message.versions || []).slice(0, MAX_SESSION_MESSAGE_VERSIONS)) {
        if (Array.isArray(version.subsequentMessages) && version.subsequentMessages.length > 0) {
          stack.push({
            depth: frame.depth + 1,
            messages: version.subsequentMessages.slice(0, MAX_SESSION_MESSAGE_BRANCH_MESSAGES),
          });
        }
      }
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

function createVersionFromMessage(message: ChatMessage): ChatMessage['versions'][number] {
  return {
    content: message.content || '',
    createdAt: message.timestamp || Date.now(),
    kind: 'original',
    subsequentMessages: [],
    ...(message.apiTranscript ? { apiTranscript: message.apiTranscript } : {}),
  };
}

function areApiTranscriptsEquivalent(
  left: ChatMessage['versions'][number]['apiTranscript'] | undefined,
  right: ChatMessage['versions'][number]['apiTranscript'] | undefined,
): boolean {
  const normalizedLeft = normalizeApiTranscriptMessages(left);
  const normalizedRight = normalizeApiTranscriptMessages(right);
  if (!normalizedLeft && !normalizedRight) {
    return true;
  }
  if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  for (let index = 0; index < normalizedLeft.length; index += 1) {
    if (!areApiTranscriptMessagesEquivalent(normalizedLeft[index], normalizedRight[index])) {
      return false;
    }
  }
  return true;
}

function areApiTranscriptMessagesEquivalent(left: ApiTranscriptMessage, right: ApiTranscriptMessage): boolean {
  return (
    left.role === right.role &&
    areApiTranscriptContentsEquivalent(left.content, right.content) &&
    (left.reasoning_content ?? '') === (right.reasoning_content ?? '') &&
    (left.tool_call_id ?? '') === (right.tool_call_id ?? '') &&
    (left.name ?? '') === (right.name ?? '') &&
    areApiTranscriptToolCallsEquivalent(left.tool_calls, right.tool_calls)
  );
}

function areApiTranscriptContentsEquivalent(
  left: ChatMessageContent | null | undefined,
  right: ChatMessageContent | null | undefined,
): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left === right;
  if (typeof left === 'string' || typeof right === 'string') return left === right;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (!areApiTranscriptContentPartsEquivalent(left[index], right[index])) {
      return false;
    }
  }
  return true;
}

function areApiTranscriptContentPartsEquivalent(
  left: ChatMessageContentPart,
  right: ChatMessageContentPart,
): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'text' && right.type === 'text') {
    return left.text === right.text;
  }
  if (left.type === 'image_url' && right.type === 'image_url') {
    return (
      left.image_url.url === right.image_url.url &&
      (left.image_url.detail ?? '') === (right.image_url.detail ?? '')
    );
  }
  return false;
}

function areApiTranscriptToolCallsEquivalent(
  left: ApiTranscriptMessage['tool_calls'] | undefined,
  right: ApiTranscriptMessage['tool_calls'] | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right || left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    const leftCall = left[index];
    const rightCall = right[index];
    if (
      leftCall.id !== rightCall.id ||
      leftCall.type !== rightCall.type ||
      leftCall.function.name !== rightCall.function.name ||
      leftCall.function.arguments !== rightCall.function.arguments
    ) {
      return false;
    }
  }
  return true;
}

function isSameMessageVersion(
  left: ChatMessage['versions'][number],
  right: ChatMessage['versions'][number],
): boolean {
  return (
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    left.kind === right.kind &&
    (!Array.isArray(left.subsequentMessages) || left.subsequentMessages.length === 0) &&
    (!Array.isArray(right.subsequentMessages) || right.subsequentMessages.length === 0) &&
    areApiTranscriptsEquivalent(left.apiTranscript, right.apiTranscript)
  );
}

function getNormalizedMessageVersions(message: ChatMessage): ChatMessage['versions'] {
  return Array.isArray(message.versions) && message.versions.length > 0
    ? message.versions.slice(0, MAX_SESSION_MESSAGE_VERSIONS)
    : [createVersionFromMessage(message)];
}

function mergeMatchingMessages(preferred: ChatMessage): ChatMessage {
  const versions = getNormalizedMessageVersions(preferred);
  const preferredVersion = createVersionFromMessage(preferred);
  const preferredVersionIndex = versions.findIndex((version) => isSameMessageVersion(version, preferredVersion));

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

  const incomingToMerge = incomingMessages.slice(0, MAX_SESSION_MESSAGE_NODES);
  const persistedToMerge = persistedMessages.slice(0, MAX_SESSION_MESSAGE_NODES);
  const incomingById = new Map(incomingToMerge.map((message) => [message.id, message]));
  const persistedById = new Map(persistedToMerge.map((message) => [message.id, message]));
  const incomingIds = collectMessageIds(incomingToMerge);
  const mergedById = new Map<string, ChatMessage>();

  for (const incoming of incomingToMerge) {
    const persisted = persistedById.get(incoming.id);
    mergedById.set(
      incoming.id,
      persisted
        ? mergeMatchingMessages(options.preferredSource === 'persisted' ? persisted : incoming)
        : incoming
    );
  }

  for (const persisted of persistedToMerge) {
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

function normalizeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

interface NormalizeSessionMessagesContext {
  messageNodes: number;
  messageIds: Set<string>;
  topLevelMessageIds: Set<string>;
}

function createUniqueMessageId(context: NormalizeSessionMessagesContext): string {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `msg-${crypto.randomUUID()}`;
    if (!context.messageIds.has(id)) {
      return id;
    }
  }
  return `msg-${Date.now()}-${context.messageNodes}-${context.messageIds.size}`;
}

function normalizeMessageId(value: unknown, context: NormalizeSessionMessagesContext, depth: number): string {
  const id = typeof value === 'string'
    ? value.trim().slice(0, MAX_SESSION_MESSAGE_ID_CHARS)
    : '';
  if (
    id &&
    !context.messageIds.has(id) &&
    (depth === 0 || !context.topLevelMessageIds.has(id))
  ) {
    context.messageIds.add(id);
    return id;
  }

  const fallbackId = createUniqueMessageId(context);
  context.messageIds.add(fallbackId);
  return fallbackId;
}

function normalizeMessageVersion(
  value: unknown,
  fallbackContent: string,
  context: NormalizeSessionMessagesContext,
  depth: number,
): ChatMessage['versions'][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const content = typeof value.content === 'string' ? value.content : fallbackContent;
  const createdAt = normalizeTimestamp(value.createdAt);
  const kind = value.kind;
  if (kind !== 'regeneration' && kind !== 'edit' && kind !== 'original') {
    return null;
  }
  const subsequentMessages = Array.isArray(value.subsequentMessages) && depth < MAX_SESSION_MESSAGE_BRANCH_DEPTH
    ? normalizeSessionMessagesInternal(
        value.subsequentMessages.slice(0, MAX_SESSION_MESSAGE_BRANCH_MESSAGES),
        context,
        depth + 1,
      )
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

function selectSessionMessageVersionEntries(
  value: unknown,
  currentVersionIndex: number,
): Array<{ index: number; value: unknown }> {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const activeIndex = currentVersionIndex >= 0 && currentVersionIndex < value.length
    ? currentVersionIndex
    : 0;
  const keepIndexes = new Set<number>([activeIndex]);
  for (let index = value.length - 1; index >= 0 && keepIndexes.size < MAX_SESSION_MESSAGE_VERSIONS; index -= 1) {
    keepIndexes.add(index);
  }

  return Array.from(keepIndexes)
    .sort((left, right) => left - right)
    .map((index) => ({ index, value: value[index] }));
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

function normalizeImageSourceCandidates(value: readonly unknown[]): string[] | undefined {
  const sources: string[] = [];
  const entryLimit = Math.min(value.length, MAX_SESSION_IMAGE_SOURCE_ENTRIES);
  for (let index = 0; index < entryLimit && sources.length < MAX_SESSION_IMAGE_SOURCES; index += 1) {
    const item = value[index];
    const source = typeof item === 'string' ? normalizeRenderableImageSrc(item) : null;
    if (source && !parseVideoUrl(source)) {
      sources.push(source);
    }
  }

  return sources.length > 0 ? sources : undefined;
}

function normalizePersistedImageSources(value: unknown): string[] | undefined {
  return Array.isArray(value) ? normalizeImageSourceCandidates(value) : undefined;
}

function extractActiveVersionImageSources(role: ChatMessage['role'], content: string): string[] | undefined {
  if (role === 'user') {
    return normalizeImageSourceCandidates(
      parseMarkdownImageTokens(content, { maxTokens: MAX_SESSION_IMAGE_SOURCE_ENTRIES })
        .map((token) => token.src),
    );
  }
  if (role === 'assistant') {
    return normalizeImageSourceCandidates(
      parseMarkdownAndHtmlImageTokens(content, { maxTokens: MAX_SESSION_IMAGE_SOURCE_ENTRIES })
        .map((token) => token.src),
    );
  }
  return undefined;
}

function normalizeSessionMessage(
  value: unknown,
  context: NormalizeSessionMessagesContext,
  depth: number,
): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'system') {
    return null;
  }

  const content = typeof value.content === 'string' ? value.content : '';
  const timestamp = normalizeTimestamp(value.timestamp);
  const rawCurrentVersionIndex = typeof value.currentVersionIndex === 'number'
    ? Math.floor(value.currentVersionIndex)
    : 0;
  const versionEntries = selectSessionMessageVersionEntries(value.versions, rawCurrentVersionIndex);
  const normalizedVersionEntries = versionEntries
    .map((entry) => ({
      index: entry.index,
      version: normalizeMessageVersion(entry.value, content, context, depth),
    }))
    .filter((entry): entry is { index: number; version: ChatMessage['versions'][number] } =>
      entry.version !== null && canRoleUseVersionKind(role, entry.version.kind)
    );
  const versions = normalizedVersionEntries.map((entry) => entry.version);
  const candidateVersions: ChatMessage['versions'] = versions.length > 0
    ? versions
    : [{
        content,
        createdAt: timestamp,
        kind: 'original',
        subsequentMessages: [],
      }];
  const selectedCurrentVersionIndex = normalizedVersionEntries.findIndex(
    (entry) => entry.index === rawCurrentVersionIndex,
  );
  const normalizedVersions = candidateVersions;
  const currentVersionIndex = selectedCurrentVersionIndex >= 0 ? selectedCurrentVersionIndex : 0;
  const activeVersion = normalizedVersions[currentVersionIndex] ?? normalizedVersions[0]!;
  const activeContent = activeVersion.content;
  const topLevelMatchesActiveVersion = content === activeContent;
  const normalizedTopLevelApiTranscript = normalizeApiTranscriptMessages(value.apiTranscript);
  const apiTranscript = activeVersion.apiTranscript
    ?? (topLevelMatchesActiveVersion ? normalizedTopLevelApiTranscript : undefined);

  if (apiTranscript && !normalizedVersions[currentVersionIndex]?.apiTranscript) {
    normalizedVersions[currentVersionIndex] = {
      ...normalizedVersions[currentVersionIndex],
      apiTranscript,
    };
  }
  const activeVersionImageSources = extractActiveVersionImageSources(role, activeContent);
  const persistedImageSources = normalizePersistedImageSources(value.imageSources);
  const imageSources = activeVersionImageSources
    ?? (topLevelMatchesActiveVersion ? persistedImageSources : undefined);

  return {
    id: normalizeMessageId(value.id, context, depth),
    role,
    content: activeContent,
    ...(apiTranscript ? { apiTranscript } : {}),
    ...(imageSources ? { imageSources } : {}),
    modelId: typeof value.modelId === 'string' ? value.modelId : '',
    timestamp,
    versions: normalizedVersions,
    currentVersionIndex,
  };
}

function normalizeSessionMessagesInternal(
  value: unknown,
  context: NormalizeSessionMessagesContext,
  depth: number,
): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ChatMessage[] = [];
  for (const item of value) {
    if (context.messageNodes >= MAX_SESSION_MESSAGE_NODES) {
      break;
    }
    context.messageNodes += 1;

    const message = normalizeSessionMessage(item, context, depth);
    if (!message) {
      continue;
    }

    normalized.push(message);
  }

  return normalized;
}

export function normalizeSessionMessages(value: unknown): ChatMessage[] {
  const topLevelMessageIds = new Set<string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) {
        continue;
      }
      const id = typeof item.id === 'string'
        ? item.id.trim().slice(0, MAX_SESSION_MESSAGE_ID_CHARS)
        : '';
      if (id && !topLevelMessageIds.has(id)) {
        topLevelMessageIds.add(id);
      }
    }
  }
  return normalizeSessionMessagesInternal(value, {
    messageNodes: 0,
    messageIds: new Set(),
    topLevelMessageIds,
  }, 0);
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
    const content = await readSessionJsonContent(path);
    if (content !== null) {
      try {
        const parsed: unknown = JSON.parse(content);
        const persistedMessages = parseSessionMessagesPayload(sessionId, parsed);
        if (persistedMessages) {
          messagesToWrite = mergeSessionMessages(messages, persistedMessages, {
            preferredSource: 'incoming',
          });
        }
      } catch {
      }
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

async function canReadSessionJson(path: string): Promise<boolean> {
  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(path).catch(() => null);
  return (
    fileInfo?.isFile !== false &&
    typeof fileInfo?.size === 'number' &&
    fileInfo.size <= MAX_SESSION_MESSAGES_BYTES
  );
}

async function readSessionJsonContent(path: string): Promise<string | null> {
  if (!(await canReadSessionJson(path))) {
    return null;
  }

  const content = await getStorageAdapter().readFile(path).catch(() => null);
  if (content === null) {
    return null;
  }
  return content.length <= MAX_SESSION_MESSAGES_BYTES ? content : null;
}

export async function saveSessionJson(sessionId: string, messages: ChatMessage[]) {
  assertSafeChatSessionId(sessionId);
  if (isSessionJsonDeleteBlocked(sessionId)) return;
  await getSessionQueue(sessionId).saveNow(messages);
}

export function scheduleSessionJsonSave(
  sessionId: string,
  messages: ChatMessage[],
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  assertSafeChatSessionId(sessionId);
  if (isSessionJsonDeleteBlocked(sessionId)) return;
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

export async function flushPendingSessionJsonSave(sessionId: string): Promise<void> {
  assertSafeChatSessionId(sessionId);
  const queue = sessionQueues.get(sessionId);
  if (!queue) return;
  await queue.flush();
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
  deletingSessionJsons.add(sessionId);
  const queue = sessionQueues.get(sessionId);
  if (queue) {
    queue.cancel();
    try {
      await queue.flush();
    } catch {
    }
    sessionQueues.delete(sessionId);
  }

  const storage = getStorageAdapter();
  const path = await getSessionJsonPath(sessionId);
  let deleted = false;
  try {
    if (await storage.exists(path)) {
      await storage.deleteFile(path);
      autoSyncTrigger?.(sessionId);
    }
    deleted = true;
  } finally {
    deletingSessionJsons.delete(sessionId);
    if (deleted) {
      rememberDeletedSessionJson(sessionId);
    }
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
          const content = await readSessionJsonContent(path);
          if (content === null) {
            return null;
          }
          const parsed: unknown = JSON.parse(content);
          return parseSessionMessagesPayload(sessionId, parsed);
      } catch (error) {
          return null;
      }
  }
  return null;
}
