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
}

export interface ManagedBudgetPayload {
  active?: unknown;
  usedPercent?: unknown;
  remainingPercent?: unknown;
  status?: unknown;
}
