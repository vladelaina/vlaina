import type { AIModel, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { githubCommands } from '@/lib/tauri/githubAuthCommands';
import { webGithubCommands } from '@/lib/tauri/webGithubCommands';

export const MANAGED_PROVIDER_ID = 'nekotick-managed';
export const MANAGED_PROVIDER_NAME = 'NekoTick AI';
export const MANAGED_API_BASE = 'https://api.nekotick.com/v1';

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
    // Never persist GitHub access token in AI provider state.
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

export async function getManagedAccessToken(): Promise<string | null> {
  if (hasBackendCommands()) {
    const token = await githubCommands.getManagedSessionToken();
    const normalized = typeof token === 'string' ? token.trim() : '';
    return normalized || null;
  }
  return webGithubCommands.getSessionToken();
}

export async function fetchManagedModels(accessToken: string): Promise<AIModel[]> {
  if (hasBackendCommands()) {
    const payload = (await githubCommands.getManagedModels()) as ManagedModelsPayload | undefined;
    return normalizeManagedModelsPayload(payload ?? {});
  }

  const response = await fetch(`${MANAGED_API_BASE}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch managed models: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ManagedModelsPayload;
  return normalizeManagedModelsPayload(payload);
}

export async function fetchManagedBudget(accessToken: string): Promise<ManagedBudgetStatus> {
  if (hasBackendCommands()) {
    const payload = (await githubCommands.getManagedBudget()) as ManagedBudgetPayload | undefined;
    return normalizeManagedBudgetPayload(payload ?? {});
  }

  const response = await fetch(`${MANAGED_API_BASE}/budget`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch managed budget: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ManagedBudgetPayload;
  return normalizeManagedBudgetPayload(payload);
}
