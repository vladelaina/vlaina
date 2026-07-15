import type {
  AIModel,
  ApiTranscriptMessage,
  ChatMessage,
  ChatMessageContent,
  ChatSendOptions,
  Provider,
} from '@/lib/ai/types';
import type { WebSearchStatus } from '@/lib/ai/webSearch/types';

export interface ChatE2EMockResponse {
  chunks?: string[];
  final?: string;
  delayMs?: number;
  hold?: boolean;
  apiTranscript?: ApiTranscriptMessage[];
  webSearchStatuses?: WebSearchStatus[];
}

export interface ChatE2EMockRequest {
  id: string;
  content: ChatMessageContent;
  historyLength: number;
  modelId: string;
  providerId: string;
  webSearchEnabled: boolean;
  createdAt: number;
}

interface PendingRequest {
  id: string;
  response: ChatE2EMockResponse;
  resolve: (content: string) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
}

interface MockSendOptions {
  content: ChatMessageContent;
  history: ChatMessage[];
  model: AIModel;
  provider: Provider;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
  options?: ChatSendOptions;
}

export type ChatE2EMockSendResult =
  | { handled: true; content: string }
  | { handled: false };

let installed = false;
let requestCounter = 0;
let queuedResponses: ChatE2EMockResponse[] = [];
let requests: ChatE2EMockRequest[] = [];
const pendingRequests = new Map<string, PendingRequest>();

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timeoutId);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function cloneResponse(response: ChatE2EMockResponse): ChatE2EMockResponse {
  return {
    ...response,
    chunks: response.chunks ? [...response.chunks] : undefined,
    apiTranscript: response.apiTranscript ? structuredClone(response.apiTranscript) : undefined,
    webSearchStatuses: response.webSearchStatuses ? structuredClone(response.webSearchStatuses) : undefined,
  };
}

function emitApiTranscript(options: ChatSendOptions | undefined, response: ChatE2EMockResponse, signal?: AbortSignal) {
  throwIfAborted(signal);
  if (response.apiTranscript) {
    options?.onApiTranscript?.(structuredClone(response.apiTranscript));
  }
  throwIfAborted(signal);
}

async function playResponse(
  response: ChatE2EMockResponse,
  onChunk: (chunk: string) => void,
  options?: ChatSendOptions,
  signal?: AbortSignal,
): Promise<string> {
  let lastChunk = '';
  const delayMs = Math.max(0, response.delayMs ?? 0);

  for (const status of response.webSearchStatuses ?? []) {
    await wait(delayMs, signal);
    throwIfAborted(signal);
    options?.onWebSearchStatus?.(structuredClone(status));
    throwIfAborted(signal);
  }

  for (const chunk of response.chunks ?? []) {
    await wait(delayMs, signal);
    throwIfAborted(signal);
    lastChunk = chunk;
    onChunk(chunk);
    throwIfAborted(signal);
  }

  const final = response.final ?? lastChunk;
  if (response.final !== undefined && response.final !== lastChunk) {
    await wait(delayMs, signal);
    throwIfAborted(signal);
    onChunk(response.final);
    throwIfAborted(signal);
  }

  emitApiTranscript(options, response, signal);
  return final;
}

export function installChatE2EMock(): void {
  if (!import.meta.env.DEV) return;
  installed = true;
}

export function resetChatE2EMock(): void {
  for (const pending of pendingRequests.values()) {
    pending.reject(createAbortError());
  }
  pendingRequests.clear();
  queuedResponses = [];
  requests = [];
  requestCounter = 0;
  installed = import.meta.env.DEV && installed;
}

export function enqueueChatE2EMockResponse(response: ChatE2EMockResponse): void {
  if (!installed) {
    throw new Error('Chat E2E mock is not installed.');
  }
  queuedResponses.push(cloneResponse(response));
}

export function getChatE2EMockRequests(): ChatE2EMockRequest[] {
  return structuredClone(requests);
}

export function getChatE2EMockPendingRequestIds(): string[] {
  return Array.from(pendingRequests.keys());
}

export async function resolveChatE2EMockPendingRequest(
  requestId?: string,
  override?: ChatE2EMockResponse,
): Promise<boolean> {
  const targetId = requestId ?? pendingRequests.keys().next().value;
  if (!targetId) return false;
  const pending = pendingRequests.get(targetId);
  if (!pending) return false;

  pendingRequests.delete(targetId);
  try {
    const content = await playResponse(
      cloneResponse(override ?? pending.response),
      () => {},
      undefined,
      pending.signal,
    );
    pending.resolve(content);
  } catch (error) {
    pending.reject(error);
  }
  return true;
}

async function playInitialHeldResponse(
  response: ChatE2EMockResponse,
  onChunk: (chunk: string) => void,
  options?: ChatSendOptions,
  signal?: AbortSignal,
): Promise<void> {
  const delayMs = Math.max(0, response.delayMs ?? 0);
  for (const status of response.webSearchStatuses ?? []) {
    await wait(delayMs, signal);
    throwIfAborted(signal);
    options?.onWebSearchStatus?.(structuredClone(status));
    throwIfAborted(signal);
  }
  for (const chunk of response.chunks ?? []) {
    await wait(delayMs, signal);
    throwIfAborted(signal);
    onChunk(chunk);
    throwIfAborted(signal);
  }
}

export async function maybeSendChatE2EMockMessage({
  content,
  history,
  model,
  provider,
  onChunk,
  signal,
  options,
}: MockSendOptions): Promise<ChatE2EMockSendResult> {
  if (!import.meta.env.DEV || !installed) {
    return { handled: false };
  }

  const response = queuedResponses.shift() ?? {
    final: 'E2E mock response',
    apiTranscript: [{ role: 'assistant', content: 'E2E mock response' }],
  };
  const id = `chat-e2e-request-${requestCounter += 1}`;
  requests.push({
    id,
    content,
    historyLength: history.length,
    modelId: model.id,
    providerId: provider.id,
    webSearchEnabled: options?.webSearchEnabled === true,
    createdAt: Date.now(),
  });

  if (!response.hold) {
    return {
      handled: true,
      content: await playResponse(response, onChunk, options, signal),
    };
  }

  await playInitialHeldResponse(response, onChunk, options, signal);

  const contentPromise = new Promise<string>((resolve, reject) => {
    const abort = () => {
      pendingRequests.delete(id);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', abort, { once: true });
    pendingRequests.set(id, {
      id,
      response,
      resolve: (value) => {
        signal?.removeEventListener('abort', abort);
        resolve(value);
      },
      reject: (error) => {
        signal?.removeEventListener('abort', abort);
        reject(error);
      },
      signal,
    });
  });

  return {
    handled: true,
    content: await contentPromise,
  };
}
