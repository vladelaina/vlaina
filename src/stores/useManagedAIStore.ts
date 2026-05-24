import { create } from 'zustand'
import {
  fetchManagedBudget,
  getManagedServiceErrorMessage,
  type ManagedBudgetStatus,
} from '@/lib/ai/managedService'

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

let budgetRefreshPromise: Promise<void> | null = null
let budgetMutationVersion = 0

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
  },
}))
