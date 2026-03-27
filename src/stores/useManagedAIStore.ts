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
  refreshBudget: () => Promise<void>
  clearBudget: () => void
}

export const useManagedAIStore = create<ManagedAIState>((set) => ({
  budget: null,
  isRefreshingBudget: false,
  budgetError: null,
  lastBudgetSyncAt: null,

  refreshBudget: async () => {
    set({ isRefreshingBudget: true, budgetError: null })
    try {
      const budget = await fetchManagedBudget()
      set({
        budget,
        isRefreshingBudget: false,
        budgetError: null,
        lastBudgetSyncAt: Date.now(),
      })
    } catch (error) {
      set({
        budget: null,
        isRefreshingBudget: false,
        budgetError: getManagedServiceErrorMessage(error) || 'Failed to refresh budget',
        lastBudgetSyncAt: null,
      })
    }
  },

  clearBudget: () =>
    set({
      budget: null,
      isRefreshingBudget: false,
      budgetError: null,
      lastBudgetSyncAt: null,
    }),
}))
