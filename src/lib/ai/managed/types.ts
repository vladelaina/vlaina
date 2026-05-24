import type { AIModel } from '@/lib/ai/types';

export type ManagedRuntime = 'desktop' | 'web'

export interface ManagedBudgetStatus {
  active: boolean;
  usedPercent: number;
  remainingPercent: number;
  status: string;
}

export interface ManagedBudgetSnapshot extends ManagedBudgetStatus {
  requestId: string
  capturedAt: number
  runtime: ManagedRuntime
}

export interface ManagedModelsPayload {
  data?: unknown;
  model_catalog_version?: unknown;
}

export interface ManagedModelCatalog {
  models: AIModel[];
  version: string | null;
}

export interface ManagedModelsVersionPayload {
  success?: unknown;
  model_catalog_version?: unknown;
}

export interface ManagedBudgetPayload {
  active?: unknown;
  usedPercent?: unknown;
  remainingPercent?: unknown;
  status?: unknown;
  data?: unknown;
  budget?: unknown;
}
