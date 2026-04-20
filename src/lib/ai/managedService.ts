import type { AIModel, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';
import { hasBackendCommands } from '@/lib/desktop/backend';
import { accountCommands } from '@/lib/account/desktopCommands';
import { webAccountCommands } from '@/lib/account/webCommands';

export const MANAGED_PROVIDER_ID = 'vlaina-managed';
export const MANAGED_PROVIDER_NAME = 'vlaina';
export const MANAGED_API_BASE = 'https://api.vlaina.com/v1';
export const MANAGED_AUTH_REQUIRED_ERROR = 'vlaina sign-in required';

type ManagedClientDiagnostic = Record<string, unknown>
type ManagedRuntime = 'desktop' | 'web'
type ManagedBudgetSnapshot = ManagedBudgetStatus & {
  requestId: string
  capturedAt: number
  runtime: ManagedRuntime
}

let managedDiagnosticCounter = 0
let lastManagedBudgetSnapshot: ManagedBudgetSnapshot | null = null

export interface ManagedBudgetStatus {
  active: boolean;
  usedPercent: number;
  remainingPercent: number;
  status: string;
}

interface ManagedModelsPayload {
  data?: unknown;
}

interface ManagedBudgetPayload {
  active?: unknown;
  usedPercent?: unknown;
  remainingPercent?: unknown;
  status?: unknown;
}

export function getManagedServiceErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }

  if (error instanceof Error) {
    return error.message.trim();
  }

  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message.trim();
  }

  return String(error ?? '').trim();
}

export function isManagedProviderId(providerId: string | null | undefined): boolean {
  return providerId === MANAGED_PROVIDER_ID;
}

export function isManagedServiceRecoverableError(error: unknown): boolean {
  const message = getManagedServiceErrorMessage(error);
  if (!message) return false;

  if (message === MANAGED_AUTH_REQUIRED_ERROR) {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('error sending request') ||
    normalized.includes('timed out') ||
    normalized.includes('aborterror')
  );
}

function logManagedClientDiagnostic(event: string, details: ManagedClientDiagnostic): void {
  void event
  void details
}

function getManagedRuntime(): ManagedRuntime {
  return hasBackendCommands() ? 'desktop' : 'web'
}

function createManagedDiagnosticId(prefix: string): string {
  managedDiagnosticCounter += 1
  return `${prefix}-${Date.now()}-${managedDiagnosticCounter}`
}

function toIsoTimestamp(value: number): string {
  return new Date(value).toISOString()
}

function summarizeManagedMessageContent(content: unknown): Record<string, unknown> {
  if (typeof content === 'string') {
    return {
      contentType: 'text',
      textLength: content.length,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: ['text'],
    }
  }

  if (!Array.isArray(content)) {
    return {
      contentType: content == null ? 'empty' : typeof content,
      textLength: 0,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: [],
    }
  }

  let textLength = 0
  let nonTextPartCount = 0
  const partTypes: string[] = []

  for (const part of content) {
    if (typeof part === 'string') {
      textLength += part.length
      partTypes.push('text')
      continue
    }

    if (!part || typeof part !== 'object') {
      partTypes.push(typeof part)
      nonTextPartCount += 1
      continue
    }

    const value = part as Record<string, unknown>
    const type = typeof value.type === 'string' ? value.type : 'object'
    partTypes.push(type)

    if (typeof value.text === 'string') {
      textLength += value.text.length
      continue
    }

    if (typeof value.input_text === 'string') {
      textLength += value.input_text.length
      continue
    }

    nonTextPartCount += 1
  }

  return {
    contentType: 'parts',
    textLength,
    partCount: content.length,
    nonTextPartCount,
    partTypes: partTypes.slice(0, 8),
  }
}

function summarizeManagedMessage(entry: unknown, index: number): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') {
    return {
      index,
      role: 'invalid',
      contentType: 'invalid',
      textLength: 0,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: [],
    }
  }

  const value = entry as Record<string, unknown>
  const contentSummary = summarizeManagedMessageContent(value.content)

  return {
    index,
    role: typeof value.role === 'string' ? value.role : 'unknown',
    ...contentSummary,
  }
}

function buildBudgetContext(now: number): Record<string, unknown> {
  if (!lastManagedBudgetSnapshot) {
    return {
      budgetSnapshotKnown: false,
    }
  }

  return {
    budgetSnapshotKnown: true,
    budgetSnapshotRequestId: lastManagedBudgetSnapshot.requestId,
    budgetSnapshotRuntime: lastManagedBudgetSnapshot.runtime,
    budgetSnapshotCapturedAt: toIsoTimestamp(lastManagedBudgetSnapshot.capturedAt),
    budgetSnapshotAgeMs: now - lastManagedBudgetSnapshot.capturedAt,
    budgetActive: lastManagedBudgetSnapshot.active,
    budgetStatus: lastManagedBudgetSnapshot.status,
    budgetUsedPercent: lastManagedBudgetSnapshot.usedPercent,
    budgetRemainingPercent: lastManagedBudgetSnapshot.remainingPercent,
  }
}

function summarizeManagedError(error: unknown): Record<string, unknown> {
  const message = getManagedServiceErrorMessage(error)

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: message,
      errorStackPreview: error.stack?.split('\n').slice(0, 3).join(' | ') ?? null,
      isAbort: error.name === 'AbortError',
    }
  }

  if (error && typeof error === 'object') {
    return {
      errorName: null,
      errorMessage: message,
      errorKeys: Object.keys(error as Record<string, unknown>).slice(0, 8),
      isAbort: message.toLowerCase().includes('abort'),
    }
  }

  return {
    errorName: null,
    errorMessage: message,
    errorStackPreview: null,
    isAbort: message.toLowerCase().includes('abort'),
  }
}

function summarizeManagedChatBody(body: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? body.messages : []
  const messageOutline = messages.map((entry, index) => summarizeManagedMessage(entry, index))
  const roles = messageOutline.map((entry) => entry.role)
  const lastMessage = messageOutline[messageOutline.length - 1] ?? null
  const totalTextLength = messageOutline.reduce((sum, entry) => {
    const value = typeof entry.textLength === 'number' ? entry.textLength : 0
    return sum + value
  }, 0)

  return {
    model: typeof body.model === 'string' ? body.model : null,
    stream: body.stream === true,
    messageCount: messages.length,
    temperature: typeof body.temperature === 'number' ? body.temperature : null,
    maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : null,
    toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
    hasTools: Array.isArray(body.tools) && body.tools.length > 0,
    toolChoice:
      typeof body.tool_choice === 'string'
        ? body.tool_choice
        : body.tool_choice && typeof body.tool_choice === 'object'
          ? 'object'
          : null,
    roleSequence: roles.join(' > ') || null,
    totalTextLength,
    lastMessageRole: lastMessage && typeof lastMessage.role === 'string' ? lastMessage.role : null,
    lastMessageTextLength:
      lastMessage && typeof lastMessage.textLength === 'number' ? lastMessage.textLength : null,
    lastMessageContentType:
      lastMessage && typeof lastMessage.contentType === 'string' ? lastMessage.contentType : null,
    messageOutline: messageOutline.slice(-6),
  }
}

export function createManagedProvider(now: number): Provider {
  return {
    id: MANAGED_PROVIDER_ID,
    name: MANAGED_PROVIDER_NAME,
    type: 'newapi',
    apiHost: MANAGED_API_BASE,
    apiKey: '',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeManagedModelsPayload(payload: ManagedModelsPayload): AIModel[] {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const now = Date.now();
  const seen = new Set<string>();

  const models: AIModel[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const value = row as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (!id || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());

    models.push({
      id: buildScopedModelId(MANAGED_PROVIDER_ID, id),
      apiModelId: id,
      name: normalizeModelName(value, id),
      group: normalizeModelGroup(value, id),
      providerId: MANAGED_PROVIDER_ID,
      enabled: true,
      createdAt: now,
    });
  }

  return models.sort((a, b) => a.apiModelId.localeCompare(b.apiModelId));
}

function normalizeManagedBudgetPayload(payload: ManagedBudgetPayload): ManagedBudgetStatus {
  return {
    active: payload.active === true,
    usedPercent: typeof payload.usedPercent === 'number' ? payload.usedPercent : 0,
    remainingPercent: typeof payload.remainingPercent === 'number' ? payload.remainingPercent : 0,
    status: typeof payload.status === 'string' ? payload.status : 'inactive',
  };
}

function normalizeModelName(model: Record<string, unknown>, fallback: string): string {
  const display = typeof model.display_name === 'string' ? model.display_name.trim() : '';
  if (display) return display;
  const name = typeof model.name === 'string' ? model.name.trim() : '';
  return name || fallback;
}

function normalizeModelGroup(model: Record<string, unknown>, modelId: string): string {
  const group = typeof model.group === 'string' ? model.group.trim() : '';
  if (group) return group;
  if (modelId.includes('/')) return modelId.split('/')[0] || 'other';
  if (modelId.includes(':')) return modelId.split(':')[0] || 'other';
  if (modelId.includes('-')) return modelId.split('-')[0] || 'other';
  return 'other';
}

async function parseManagedError(response: Response): Promise<Error> {
  const raw = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403) {
    webAccountCommands.clearClientSession();
    return new Error(MANAGED_AUTH_REQUIRED_ERROR);
  }

  if (!raw) {
    return new Error(`Managed API request failed: HTTP ${response.status}`);
  }

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const message = typeof payload.error === 'string'
      ? payload.error
      : typeof payload.message === 'string'
        ? payload.message
        : '';
    if (message) {
      return new Error(message);
    }
  } catch {}

  return new Error(raw);
}

const MANAGED_JSON_TIMEOUT_MS = 30_000;

async function requestManagedWebJson<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), MANAGED_JSON_TIMEOUT_MS);

  const combinedSignal = init?.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${MANAGED_API_BASE}${path}`, {
      ...init,
      signal: combinedSignal,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

async function requestManagedWebStream(
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${MANAGED_API_BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    signal,
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseManagedError(response);
  }

  if (!response.body) {
    throw new Error('Managed API response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';
  let hasStartedReasoning = false;
  let hasFinishedReasoning = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') {
        continue;
      }

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      try {
        const jsonStr = trimmed.slice(6);
        const payload = JSON.parse(jsonStr) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
            };
          }>;
        };
        const delta = payload.choices?.[0]?.delta;
        const reasoning = delta?.reasoning_content;
        const content = delta?.content;

        if (reasoning) {
          if (!hasStartedReasoning) {
            fullContent += '<think>';
            hasStartedReasoning = true;
          }
          fullContent += reasoning;
        }

        if (content) {
          if (hasStartedReasoning && !hasFinishedReasoning) {
            fullContent += '</think>';
            hasFinishedReasoning = true;
          }
          fullContent += content;
        }

        if (reasoning || content) {
          onChunk(fullContent);
        }
      } catch (parseError) {
        if (import.meta.env.DEV) {
          console.warn('[managedService] SSE line parse failed:', parseError);
        }
      }
    }
  }

  if (hasStartedReasoning && !hasFinishedReasoning) {
    fullContent += '</think>';
  }

  return fullContent;
}

export async function fetchManagedModels(): Promise<AIModel[]> {
  if (hasBackendCommands()) {
    const payload = (await accountCommands.getManagedModels()) as ManagedModelsPayload | undefined;
    return normalizeManagedModelsPayload(payload ?? {});
  }

  const payload = await requestManagedWebJson<ManagedModelsPayload>('/models', {
    method: 'GET',
  });
  return normalizeManagedModelsPayload(payload ?? {});
}

export async function fetchManagedBudget(): Promise<ManagedBudgetStatus> {
  const requestId = createManagedDiagnosticId('managed-budget')
  const startedAt = Date.now()

  logManagedClientDiagnostic('budget_fetch_start', {
    requestId,
    startedAt: toIsoTimestamp(startedAt),
  })

  if (hasBackendCommands()) {
    try {
      const payload = (await accountCommands.getManagedBudget()) as ManagedBudgetPayload | undefined;
      const budget = normalizeManagedBudgetPayload(payload ?? {})
      const capturedAt = Date.now()
      lastManagedBudgetSnapshot = {
        ...budget,
        requestId,
        capturedAt,
        runtime: getManagedRuntime(),
      }
      logManagedClientDiagnostic('budget_snapshot', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        capturedAt: toIsoTimestamp(capturedAt),
        durationMs: capturedAt - startedAt,
        ...budget,
      })
      return budget
    } catch (error) {
      const failedAt = Date.now()
      logManagedClientDiagnostic('budget_fetch_error', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        failedAt: toIsoTimestamp(failedAt),
        durationMs: failedAt - startedAt,
        ...summarizeManagedError(error),
      })
      throw error
    }
  }

  try {
    const payload = await requestManagedWebJson<ManagedBudgetPayload>('/budget', {
      method: 'GET',
    });
    const budget = normalizeManagedBudgetPayload(payload ?? {})
    const capturedAt = Date.now()
    lastManagedBudgetSnapshot = {
      ...budget,
      requestId,
      capturedAt,
      runtime: getManagedRuntime(),
    }
    logManagedClientDiagnostic('budget_snapshot', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      capturedAt: toIsoTimestamp(capturedAt),
      durationMs: capturedAt - startedAt,
      ...budget,
    })
    return budget
  } catch (error) {
    const failedAt = Date.now()
    logManagedClientDiagnostic('budget_fetch_error', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      failedAt: toIsoTimestamp(failedAt),
      durationMs: failedAt - startedAt,
      ...summarizeManagedError(error),
    })
    throw error
  }
}

export async function requestManagedChatCompletion(
  body: object
): Promise<Record<string, unknown>> {
  const requestId = createManagedDiagnosticId('managed-chat')
  const startedAt = Date.now()
  const summary = summarizeManagedChatBody(body as Record<string, unknown>)
  logManagedClientDiagnostic('chat_request_start', {
    requestId,
    startedAt: toIsoTimestamp(startedAt),
    ...summary,
    ...buildBudgetContext(startedAt),
  })

  if (hasBackendCommands()) {
    try {
      const payload = (await accountCommands.managedChatCompletion(body)) as Record<string, unknown>
      const finishedAt = Date.now()
      logManagedClientDiagnostic('chat_request_success', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        finishedAt: toIsoTimestamp(finishedAt),
        durationMs: finishedAt - startedAt,
        ...summary,
        choices: Array.isArray(payload.choices) ? payload.choices.length : 0,
        ...buildBudgetContext(finishedAt),
      })
      return payload
    } catch (error) {
      const failedAt = Date.now()
      logManagedClientDiagnostic('chat_request_error', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        failedAt: toIsoTimestamp(failedAt),
        durationMs: failedAt - startedAt,
        ...summary,
        ...summarizeManagedError(error),
        ...buildBudgetContext(failedAt),
      })
      throw error
    }
  }

  try {
    const payload = await requestManagedWebJson<Record<string, unknown>>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const finishedAt = Date.now()
    logManagedClientDiagnostic('chat_request_success', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      finishedAt: toIsoTimestamp(finishedAt),
      durationMs: finishedAt - startedAt,
      ...summary,
      choices: Array.isArray(payload.choices) ? payload.choices.length : 0,
      ...buildBudgetContext(finishedAt),
    })
    return payload
  } catch (error) {
    const failedAt = Date.now()
    logManagedClientDiagnostic('chat_request_error', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      failedAt: toIsoTimestamp(failedAt),
      durationMs: failedAt - startedAt,
      ...summary,
      ...summarizeManagedError(error),
      ...buildBudgetContext(failedAt),
    })
    throw error
  }
}

export async function requestManagedChatCompletionStream(
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const requestId = createManagedDiagnosticId('managed-stream')
  const startedAt = Date.now()
  const summary = summarizeManagedChatBody(body)
  let chunkCount = 0
  let firstChunkAt: number | null = null
  let lastChunkAt: number | null = null
  let lastChunkLength = 0

  const tracedOnChunk = (chunk: string) => {
    const now = Date.now()
    chunkCount += 1
    if (firstChunkAt === null) {
      firstChunkAt = now
    }
    const deltaLength = Math.max(0, chunk.length - lastChunkLength)
    logManagedClientDiagnostic('chat_stream_chunk', {
      requestId,
      chunkIndex: chunkCount,
      at: toIsoTimestamp(now),
      elapsedMs: now - startedAt,
      sincePreviousChunkMs: lastChunkAt == null ? null : now - lastChunkAt,
      firstChunkElapsedMs: firstChunkAt - startedAt,
      contentLength: chunk.length,
      deltaLength,
    })
    lastChunkAt = now
    lastChunkLength = chunk.length
    onChunk(chunk)
  }

  logManagedClientDiagnostic('chat_stream_start', {
    requestId,
    startedAt: toIsoTimestamp(startedAt),
    signalAborted: signal?.aborted === true,
    ...summary,
    ...buildBudgetContext(startedAt),
  })

  if (hasBackendCommands()) {
    try {
      const content = await accountCommands.managedChatCompletionStream(body, tracedOnChunk, signal, requestId)
      const finishedAt = Date.now()
      logManagedClientDiagnostic('chat_stream_success', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        finishedAt: toIsoTimestamp(finishedAt),
        durationMs: finishedAt - startedAt,
        ...summary,
        chunkCount,
        firstChunkElapsedMs: firstChunkAt == null ? null : firstChunkAt - startedAt,
        lastChunkElapsedMs: lastChunkAt == null ? null : lastChunkAt - startedAt,
        contentLength: content.length,
        ...buildBudgetContext(finishedAt),
      })
      return content
    } catch (error) {
      const failedAt = Date.now()
      logManagedClientDiagnostic('chat_stream_error', {
        requestId,
        startedAt: toIsoTimestamp(startedAt),
        failedAt: toIsoTimestamp(failedAt),
        durationMs: failedAt - startedAt,
        ...summary,
        chunkCount,
        firstChunkElapsedMs: firstChunkAt == null ? null : firstChunkAt - startedAt,
        lastChunkElapsedMs: lastChunkAt == null ? null : lastChunkAt - startedAt,
        signalAborted: signal?.aborted === true,
        ...summarizeManagedError(error),
        ...buildBudgetContext(failedAt),
      })
      throw error
    }
  }

  try {
    const content = await requestManagedWebStream('/chat/completions', body, tracedOnChunk, signal)
    const finishedAt = Date.now()
    logManagedClientDiagnostic('chat_stream_success', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      finishedAt: toIsoTimestamp(finishedAt),
      durationMs: finishedAt - startedAt,
      ...summary,
      chunkCount,
      firstChunkElapsedMs: firstChunkAt == null ? null : firstChunkAt - startedAt,
      lastChunkElapsedMs: lastChunkAt == null ? null : lastChunkAt - startedAt,
      contentLength: content.length,
      ...buildBudgetContext(finishedAt),
    })
    return content
  } catch (error) {
    const failedAt = Date.now()
    logManagedClientDiagnostic('chat_stream_error', {
      requestId,
      startedAt: toIsoTimestamp(startedAt),
      failedAt: toIsoTimestamp(failedAt),
      durationMs: failedAt - startedAt,
      ...summary,
      chunkCount,
      firstChunkElapsedMs: firstChunkAt == null ? null : firstChunkAt - startedAt,
      lastChunkElapsedMs: lastChunkAt == null ? null : lastChunkAt - startedAt,
      signalAborted: signal?.aborted === true,
      ...summarizeManagedError(error),
      ...buildBudgetContext(failedAt),
    })
    throw error
  }
}
