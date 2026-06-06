import { create } from 'zustand'
import {
  fetchManagedBudget,
  getManagedServiceErrorMessage,
  type ManagedBudgetStatus,
} from '@/lib/ai/managedService'
import { normalizeManagedBudgetPayload } from '@/lib/ai/managed/normalizers'

interface ManagedAIState {
  budget: ManagedBudgetStatus | null
  isRefreshingBudget: boolean
  budgetError: string | null
  lastBudgetSyncAt: number | null
  lastBudgetAttemptAt: number | null
  refreshBudget: () => Promise<void>
  refreshBudgetIfStale: () => Promise<void>
  applyBudgetSnapshot: (budget: ManagedBudgetStatus) => void
  clearBudget: () => void
}

const BUDGET_REFRESH_INTERVAL_MS = 60_000
const BUDGET_RETRY_INTERVAL_MS = 15_000
const BUDGET_SYNC_STORAGE_KEY = 'vlaina-managed-ai-budget'
const MAX_BUDGET_SYNC_STORAGE_CHARS = 32 * 1024

let budgetRefreshPromise: Promise<void> | null = null
let budgetMutationVersion = 0

interface ManagedBudgetSyncPayload {
  budget: ManagedBudgetStatus
  syncedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readBudgetSyncPayload(raw: string | null): ManagedBudgetSyncPayload | null {
  if (!raw) {
    return null
  }
  if (raw.length > MAX_BUDGET_SYNC_STORAGE_CHARS) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ManagedBudgetSyncPayload>
    if (
      !isRecord(parsed) ||
      !isRecord(parsed.budget) ||
      typeof parsed.syncedAt !== 'number' ||
      !Number.isFinite(parsed.syncedAt) ||
      parsed.syncedAt < 0
    ) {
      return null
    }

    return {
      budget: normalizeManagedBudgetPayload({ budget: parsed.budget }),
      syncedAt: parsed.syncedAt,
    }
  } catch {
    return null
  }
}

function publishBudgetSnapshot(budget: ManagedBudgetStatus, syncedAt: number): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(BUDGET_SYNC_STORAGE_KEY, JSON.stringify({ budget, syncedAt }))
  } catch {
  }
}

function clearPublishedBudgetSnapshot(): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(BUDGET_SYNC_STORAGE_KEY)
  } catch {
  }
}

export const useManagedAIStore = create<ManagedAIState>((set, get) => ({
  budget: null,
  isRefreshingBudget: false,
  budgetError: null,
  lastBudgetSyncAt: null,
  lastBudgetAttemptAt: null,

  refreshBudget: async () => {
    if (budgetRefreshPromise) {
      return budgetRefreshPromise
    }

    const requestVersion = budgetMutationVersion
    let promise!: Promise<void>
    promise = (async () => {
      set({ isRefreshingBudget: true, budgetError: null, lastBudgetAttemptAt: Date.now() })
      try {
        const budget = await fetchManagedBudget()
        if (requestVersion !== budgetMutationVersion) {
          return
        }
        set({
          budget,
          isRefreshingBudget: false,
          budgetError: null,
          lastBudgetSyncAt: Date.now(),
        })
        publishBudgetSnapshot(budget, useManagedAIStore.getState().lastBudgetSyncAt || Date.now())
      } catch (error) {
        if (requestVersion !== budgetMutationVersion) {
          return
        }
        const message = getManagedServiceErrorMessage(error) || 'Failed to refresh budget'
        set({
          isRefreshingBudget: false,
          budgetError: message,
        })
      } finally {
        if (budgetRefreshPromise === promise) {
          budgetRefreshPromise = null
        }
      }
    })()
    budgetRefreshPromise = promise

    return budgetRefreshPromise
  },

  refreshBudgetIfStale: async () => {
    const state = get()
    const now = Date.now()

    if (state.isRefreshingBudget) {
      return budgetRefreshPromise ?? Promise.resolve()
    }

    if (state.budget && state.lastBudgetSyncAt && now - state.lastBudgetSyncAt < BUDGET_REFRESH_INTERVAL_MS) {
      return
    }

    if (!state.budget && state.lastBudgetAttemptAt && now - state.lastBudgetAttemptAt < BUDGET_RETRY_INTERVAL_MS) {
      return
    }

    return get().refreshBudget()
  },

  applyBudgetSnapshot: (budget) => {
    budgetMutationVersion += 1
    budgetRefreshPromise = null
    const now = Date.now()
    set({
      budget,
      isRefreshingBudget: false,
      budgetError: null,
      lastBudgetSyncAt: now,
      lastBudgetAttemptAt: now,
    })
    publishBudgetSnapshot(budget, now)
  },

  clearBudget: () => {
    budgetMutationVersion += 1
    budgetRefreshPromise = null
    set({
      budget: null,
      isRefreshingBudget: false,
      budgetError: null,
      lastBudgetSyncAt: null,
      lastBudgetAttemptAt: null,
    })
    clearPublishedBudgetSnapshot()
  },
}))

let managedBudgetStorageListenerRegistered = false

function registerManagedBudgetStorageListener(): void {
  if (managedBudgetStorageListenerRegistered || typeof window === 'undefined') {
    return
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== BUDGET_SYNC_STORAGE_KEY) {
      return
    }

    if (!event.newValue) {
      budgetMutationVersion += 1
      budgetRefreshPromise = null
      useManagedAIStore.setState({
        budget: null,
        isRefreshingBudget: false,
        budgetError: null,
        lastBudgetSyncAt: null,
        lastBudgetAttemptAt: null,
      })
      return
    }

    const payload = readBudgetSyncPayload(event.newValue)
    if (!payload) {
      return
    }

    const currentSyncAt = useManagedAIStore.getState().lastBudgetSyncAt || 0
    if (payload.syncedAt < currentSyncAt) {
      return
    }

    budgetMutationVersion += 1
    budgetRefreshPromise = null
    useManagedAIStore.setState({
      budget: payload.budget,
      isRefreshingBudget: false,
      budgetError: null,
      lastBudgetSyncAt: payload.syncedAt,
      lastBudgetAttemptAt: payload.syncedAt,
    })
  })

  managedBudgetStorageListenerRegistered = true
}

registerManagedBudgetStorageListener()
