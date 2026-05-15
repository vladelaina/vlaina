const BILLING_RETURN_REFRESH_KEY = 'vlaina.billing.returnRefresh.pendingAt'
const BILLING_RETURN_REFRESH_TTL_MS = 30 * 60 * 1000

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readPendingAt(): number | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const value = Number(storage.getItem(BILLING_RETURN_REFRESH_KEY))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function markBillingReturnRefreshPending(now = Date.now()): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(BILLING_RETURN_REFRESH_KEY, String(now))
}

export function clearBillingReturnRefreshPending(): void {
  getStorage()?.removeItem(BILLING_RETURN_REFRESH_KEY)
}

export function hasFreshBillingReturnRefreshPending(now = Date.now()): boolean {
  const pendingAt = readPendingAt()
  if (!pendingAt) {
    return false
  }

  if (now - pendingAt > BILLING_RETURN_REFRESH_TTL_MS) {
    clearBillingReturnRefreshPending()
    return false
  }

  return true
}
