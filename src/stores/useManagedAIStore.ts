import { create } from 'zustand'
import { fetchManagedBudget, getManagedAccessToken, type ManagedBudgetStatus } from '@/lib/ai/managedService'

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
      const accessToken = await getManagedAccessToken()
      if (!accessToken) {
        set({
          budget: null,
          isRefreshingBudget: false,
          budgetError: 'NekoTick sign-in required',
          lastBudgetSyncAt: null,
        })
        return
      }

      const budget = await fetchManagedBudget(accessToken)
      set({
        budget,
        isRefreshingBudget: false,
        budgetError: null,
        lastBudgetSyncAt: Date.now(),
      })
    } catch (error) {
      set({
        isRefreshingBudget: false,
        budgetError: error instanceof Error ? error.message : 'Failed to refresh budget',
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
