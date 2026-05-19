import type { AIModel, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';

import {
  MANAGED_API_BASE,
  MANAGED_PROVIDER_ID,
  MANAGED_PROVIDER_NAME,
} from './constants';
import type {
  ManagedModelCatalog,
  ManagedBudgetPayload,
  ManagedBudgetStatus,
  ManagedModelsPayload,
  ManagedModelsVersionPayload,
} from './types';

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

export function normalizeManagedModelsPayload(payload: ManagedModelsPayload): AIModel[] {
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
      ...normalizeModelPrice(value),
      isDefault: value.is_default === true,
      providerId: MANAGED_PROVIDER_ID,
      enabled: true,
      createdAt: now,
    });
  }

  return models.sort((a, b) => a.apiModelId.localeCompare(b.apiModelId));
}

export function normalizeManagedModelCatalogPayload(payload: ManagedModelsPayload): ManagedModelCatalog {
  return {
    models: normalizeManagedModelsPayload(payload),
    version: normalizeManagedModelCatalogVersion(payload.model_catalog_version),
  };
}

export function normalizeManagedModelsVersionPayload(payload: ManagedModelsVersionPayload): string | null {
  return normalizeManagedModelCatalogVersion(payload.model_catalog_version);
}

export function normalizeManagedBudgetPayload(payload: ManagedBudgetPayload): ManagedBudgetStatus {
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

function normalizeManagedModelCatalogVersion(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeModelGroup(model: Record<string, unknown>, modelId: string): string {
  const group = typeof model.group === 'string' ? model.group.trim() : '';
  if (group) return group;
  if (modelId.includes('/')) return modelId.split('/')[0] || 'other';
  if (modelId.includes(':')) return modelId.split(':')[0] || 'other';
  if (modelId.includes('-')) return modelId.split('-')[0] || 'other';
  return 'other';
}

function normalizeModelPrice(model: Record<string, unknown>): Pick<AIModel, 'priceTier' | 'priceScore'> {
  const priceTier = typeof model.price_tier === 'string' ? model.price_tier.trim() : '';
  const normalized: Pick<AIModel, 'priceTier' | 'priceScore'> = {};
  if (
    priceTier === '$' ||
    priceTier === '$$' ||
    priceTier === '$$$' ||
    priceTier === '$$$$' ||
    priceTier === '$$$$$'
  ) {
    normalized.priceTier = priceTier;
  }

  if (typeof model.price_score === 'number' && Number.isFinite(model.price_score) && model.price_score >= 0) {
    normalized.priceScore = model.price_score;
  }

  return normalized;
}
