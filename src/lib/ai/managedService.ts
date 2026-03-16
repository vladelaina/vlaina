import type { AIModel, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { accountCommands } from '@/lib/tauri/accountAuthCommands';
import { webAccountCommands } from '@/lib/tauri/webAccountCommands';
import { Channel } from '@tauri-apps/api/core';
import { consumeOpenAIStream, createStreamAccumulator, type StreamDeltaPayload } from '@/lib/ai/streaming';

export const MANAGED_PROVIDER_ID = 'nekotick-managed';
export const MANAGED_PROVIDER_NAME = 'NekoTick AI';
export const MANAGED_API_BASE = 'https://api.nekotick.com/v1';
export const MANAGED_AUTH_REQUIRED_ERROR = 'NekoTick sign-in required';

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

export function isManagedProviderId(providerId: string | null | undefined): boolean {
  return providerId === MANAGED_PROVIDER_ID;
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

function createAbortError(): Error {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
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
  } catch {
    // no-op
  }

  return new Error(raw);
}

async function requestManagedWebJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MANAGED_API_BASE}${path}`, {
    ...init,
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
  if (hasBackendCommands()) {
    const payload = (await accountCommands.getManagedBudget()) as ManagedBudgetPayload | undefined;
    return normalizeManagedBudgetPayload(payload ?? {});
  }

  const payload = await requestManagedWebJson<ManagedBudgetPayload>('/budget', {
    method: 'GET',
  });
  return normalizeManagedBudgetPayload(payload ?? {});
}

export async function requestManagedChatCompletion(
  body: object
): Promise<Record<string, unknown>> {
  if (hasBackendCommands()) {
    return (await accountCommands.managedChatCompletion(body)) as Record<string, unknown>;
  }

  return requestManagedWebJson<Record<string, unknown>>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function requestManagedChatCompletionStream(
  body: object,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    throw createAbortError()
  }

  if (hasBackendCommands()) {
    const accumulator = createStreamAccumulator(onChunk);
    let aborted = false;
    const onEvent = new Channel<StreamDeltaPayload>();
    onEvent.onmessage = (payload) => {
      if (aborted) {
        return;
      }
      accumulator.pushDelta(payload || {});
    };
    const streamPromise = accountCommands.managedChatCompletionStream(body, onEvent);
    if (signal) {
      await Promise.race([
        streamPromise,
        new Promise<never>((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(createAbortError());
            },
            { once: true }
          );
        }),
      ]);
    } else {
      await streamPromise;
    }
    return accumulator.finish();
  }

  const response = await fetch(`${MANAGED_API_BASE}/chat/completions`, {
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

  return consumeOpenAIStream(response, onChunk);
}
