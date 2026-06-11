import { accountCommands } from '@/lib/account/desktopCommands';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';

import {
  MANAGED_API_BASE,
  MANAGED_AUTH_REQUIRED_ERROR,
  MANAGED_PROVIDER_ID,
  MANAGED_PROVIDER_NAME,
} from './managed/constants';
import {
  getManagedServiceErrorMessage,
  isManagedServiceRecoverableError,
} from './managed/errors';
import {
  createManagedProvider,
  normalizeManagedModelCatalogPayload,
  normalizeManagedBudgetPayload,
  normalizeManagedModelsVersionPayload,
} from './managed/normalizers';
import type {
  ManagedModelCatalog,
  ManagedBudgetPayload,
  ManagedBudgetStatus,
  ManagedModelsPayload,
  ManagedModelsVersionPayload,
} from './managed/types';
import {
  requestManagedWebBinaryJson,
  requestManagedWebJson,
  requestManagedWebStream,
} from './managed/webRequests';
import {
  assertProviderJsonRequestBodySize,
  stringifyProviderJsonRequestBody,
} from './providerRequestBody';

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

export function isManagedModelId(modelId: string | null | undefined): boolean {
  return modelId === MANAGED_PROVIDER_ID || Boolean(modelId?.startsWith(`${MANAGED_PROVIDER_ID}:`));
}

export async function fetchManagedModels() {
  return (await fetchManagedModelCatalog()).models;
}

export async function fetchManagedModelCatalog(): Promise<ManagedModelCatalog> {
  if (hasElectronDesktopBridge()) {
    const payload = (await accountCommands.getManagedModels()) as ManagedModelsPayload | undefined;
    return normalizeManagedModelCatalogPayload(payload ?? {});
  }

  const payload = await requestManagedWebJson<ManagedModelsPayload>('/models', {
    method: 'GET',
  });
  return normalizeManagedModelCatalogPayload(payload ?? {});
}

export async function fetchManagedModelsVersion(): Promise<string | null> {
  if (hasElectronDesktopBridge()) {
    const payload = (await accountCommands.getManagedModelsVersion()) as ManagedModelsVersionPayload | undefined;
    return normalizeManagedModelsVersionPayload(payload ?? {});
  }

  const payload = await requestManagedWebJson<ManagedModelsVersionPayload>('/models/version', {
    method: 'GET',
  });
  return normalizeManagedModelsVersionPayload(payload ?? {});
}

export async function fetchManagedBudget(): Promise<ManagedBudgetStatus> {
  const payload = hasElectronDesktopBridge()
    ? ((await accountCommands.getManagedBudget()) as ManagedBudgetPayload | undefined)
    : await requestManagedWebJson<ManagedBudgetPayload>('/budget', { method: 'GET' });
  return normalizeManagedBudgetPayload(payload ?? {})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeManagedChatMessage(message: unknown): unknown {
  if (!isRecord(message)) {
    return message
  }

  const nextMessage = { ...message }
  const hasAssistantMetadata = Boolean(nextMessage.reasoning_content) ||
    (Array.isArray(nextMessage.tool_calls) && nextMessage.tool_calls.length > 0)
  if (nextMessage.role === 'assistant' && nextMessage.content == null && hasAssistantMetadata) {
    nextMessage.content = ''
  }
  if (
    (nextMessage.role === 'system' || nextMessage.role === 'user' || nextMessage.role === 'tool') &&
    nextMessage.content == null
  ) {
    nextMessage.content = ''
  }
  return nextMessage
}

function sanitizeManagedChatCompletionBody(body: object): Record<string, unknown> {
  const nextBody = isRecord(body) ? body : {}
  if (!Array.isArray(nextBody.messages)) {
    return nextBody
  }
  return {
    ...nextBody,
    messages: nextBody.messages.map(sanitizeManagedChatMessage),
  }
}

export async function requestManagedChatCompletion(
  body: object,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const sanitizedBody = sanitizeManagedChatCompletionBody(body)
  if (hasElectronDesktopBridge()) {
    assertProviderJsonRequestBodySize(sanitizedBody)
    return (await (signal
      ? accountCommands.managedChatCompletion(sanitizedBody, signal)
      : accountCommands.managedChatCompletion(sanitizedBody))) as Record<string, unknown>
  }
  return await requestManagedWebJson<Record<string, unknown>>('/chat/completions', {
    method: 'POST',
    body: stringifyProviderJsonRequestBody(sanitizedBody),
    signal,
  })
}

export async function requestManagedImageGeneration(
  body: object,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  if (hasElectronDesktopBridge()) {
    assertProviderJsonRequestBodySize(body)
    return (await accountCommands.managedImageGeneration(body, signal)) as Record<string, unknown>
  }
  return await requestManagedWebJson<Record<string, unknown>>('/images/generations', {
    method: 'POST',
    body: stringifyProviderJsonRequestBody(body),
    timeoutMs: 300_000,
    signal,
  })
}

export async function requestManagedImageEdit(
  body: BodyInit,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  return hasElectronDesktopBridge()
    ? ((await accountCommands.managedImageEdit(body, headers, signal)) as Record<string, unknown>)
    : await requestManagedWebBinaryJson<Record<string, unknown>>('/images/edits', body, headers, signal)
}

export async function requestManagedChatCompletionStream(
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const requestId = `managed-stream-${Date.now()}-${crypto.randomUUID()}`
  const sanitizedBody = sanitizeManagedChatCompletionBody(body)
  if (hasElectronDesktopBridge()) {
    assertProviderJsonRequestBodySize(sanitizedBody)
    return await accountCommands.managedChatCompletionStream(sanitizedBody, onChunk, signal, requestId)
  }
  return await requestManagedWebStream('/chat/completions', sanitizedBody, onChunk, signal)
}
