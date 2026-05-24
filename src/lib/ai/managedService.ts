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

export async function requestManagedChatCompletion(
  body: object
): Promise<Record<string, unknown>> {
  return hasElectronDesktopBridge()
    ? ((await accountCommands.managedChatCompletion(body)) as Record<string, unknown>)
    : await requestManagedWebJson<Record<string, unknown>>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
}

export async function requestManagedImageGeneration(
  body: object
): Promise<Record<string, unknown>> {
  return hasElectronDesktopBridge()
    ? ((await accountCommands.managedImageGeneration(body)) as Record<string, unknown>)
    : await requestManagedWebJson<Record<string, unknown>>('/images/generations', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: 300_000,
    })
}

export async function requestManagedImageEdit(
  body: BodyInit,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  return hasElectronDesktopBridge()
    ? ((await accountCommands.managedImageEdit(body, headers)) as Record<string, unknown>)
    : await requestManagedWebBinaryJson<Record<string, unknown>>('/images/edits', body, headers, signal)
}

export async function requestManagedChatCompletionStream(
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const requestId = `managed-stream-${Date.now()}-${crypto.randomUUID()}`
  return hasElectronDesktopBridge()
    ? await accountCommands.managedChatCompletionStream(body, onChunk, signal, requestId)
    : await requestManagedWebStream('/chat/completions', body, onChunk, signal)
}
