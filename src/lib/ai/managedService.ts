import { accountCommands } from '@/lib/account/desktopCommands';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';

import {
  MANAGED_API_BASE,
  MANAGED_AUTH_REQUIRED_ERROR,
  MANAGED_PROVIDER_ID,
  MANAGED_PROVIDER_NAME,
} from './managed/constants';
import {
  buildBudgetContext,
  captureManagedBudgetSnapshot,
  createManagedDiagnosticId,
  logManagedClientDiagnostic,
  summarizeManagedChatBody,
  summarizeManagedError,
  toIsoTimestamp,
} from './managed/diagnostics';
import {
  getManagedServiceErrorMessage,
  isManagedServiceRecoverableError,
} from './managed/errors';
import {
  createManagedProvider,
  normalizeManagedBudgetPayload,
  normalizeManagedModelsPayload,
} from './managed/normalizers';
import type {
  ManagedBudgetPayload,
  ManagedBudgetStatus,
  ManagedModelsPayload,
} from './managed/types';
import {
  requestManagedWebJson,
  requestManagedWebStream,
} from './managed/webRequests';

export {
  MANAGED_API_BASE,
  MANAGED_AUTH_REQUIRED_ERROR,
  MANAGED_PROVIDER_ID,
  MANAGED_PROVIDER_NAME,
  createManagedProvider,
  getManagedServiceErrorMessage,
  isManagedServiceRecoverableError,
};
export type { ManagedBudgetStatus };

export function isManagedProviderId(providerId: string | null | undefined): boolean {
  return providerId === MANAGED_PROVIDER_ID;
}

export async function fetchManagedModels() {
  if (hasElectronDesktopBridge()) {
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

  try {
    const payload = hasElectronDesktopBridge()
      ? ((await accountCommands.getManagedBudget()) as ManagedBudgetPayload | undefined)
      : await requestManagedWebJson<ManagedBudgetPayload>('/budget', { method: 'GET' });
    const budget = normalizeManagedBudgetPayload(payload ?? {})
    const capturedAt = Date.now()

    captureManagedBudgetSnapshot(budget, requestId, capturedAt)
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

  try {
    const payload = hasElectronDesktopBridge()
      ? ((await accountCommands.managedChatCompletion(body)) as Record<string, unknown>)
      : await requestManagedWebJson<Record<string, unknown>>('/chat/completions', {
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
    firstChunkAt ??= now
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

  try {
    const content = hasElectronDesktopBridge()
      ? await accountCommands.managedChatCompletionStream(body, tracedOnChunk, signal, requestId)
      : await requestManagedWebStream('/chat/completions', body, tracedOnChunk, signal)
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
