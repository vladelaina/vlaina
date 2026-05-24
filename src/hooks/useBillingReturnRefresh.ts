import { useEffect } from 'react'
import {
  clearBillingReturnRefreshPending,
  hasFreshBillingReturnRefreshPending,
} from '@/lib/billing/returnRefresh'
import { useAccountSessionStore } from '@/stores/accountSession'
import { useManagedAIStore } from '@/stores/useManagedAIStore'

const FOLLOW_UP_REFRESH_DELAYS_MS = [4000, 12_000]

export function refreshBillingEntitlementsAfterReturn(): void {
  const previousBudgetSyncAt = useManagedAIStore.getState().lastBudgetSyncAt
  void Promise.resolve(useAccountSessionStore.getState().checkStatus({ force: true })).finally(() => {
    if (!useAccountSessionStore.getState().isConnected) {
      return
    }
    const managedAIState = useManagedAIStore.getState()
    if (managedAIState.lastBudgetSyncAt === previousBudgetSyncAt) {
      void managedAIState.refreshBudget()
    }
  })
}

export function useBillingReturnRefresh(): void {
  useEffect(() => {
    const timers = new Set<number>()

    const clearTimers = () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
      timers.clear()
    }

    const triggerRefresh = () => {
      if (document.visibilityState === 'hidden') {
        return
      }
      const billingResult = new URL(window.location.href).searchParams.get('billing')
      if (billingResult === 'success' || billingResult === 'cancel') {
        return
      }
      if (!hasFreshBillingReturnRefreshPending()) {
        return
      }

      clearBillingReturnRefreshPending()
      refreshBillingEntitlementsAfterReturn()

      for (const delay of FOLLOW_UP_REFRESH_DELAYS_MS) {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          refreshBillingEntitlementsAfterReturn()
        }, delay)
        timers.add(timer)
      }
    }

    window.addEventListener('focus', triggerRefresh)
    document.addEventListener('visibilitychange', triggerRefresh)
    triggerRefresh()

    return () => {
      window.removeEventListener('focus', triggerRefresh)
      document.removeEventListener('visibilitychange', triggerRefresh)
      clearTimers()
    }
  }, [])
}
