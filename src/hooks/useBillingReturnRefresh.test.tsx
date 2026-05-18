import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markBillingReturnRefreshPending } from '@/lib/billing/returnRefresh'
import { useBillingReturnRefresh } from './useBillingReturnRefresh'

const mocks = vi.hoisted(() => ({
  isConnected: true,
  checkStatus: vi.fn().mockResolvedValue(undefined),
  clearBudget: vi.fn(),
  refreshBudget: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({
      isConnected: mocks.isConnected,
      checkStatus: mocks.checkStatus,
    }),
  },
}))

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({
      clearBudget: mocks.clearBudget,
      refreshBudget: mocks.refreshBudget,
    }),
  },
}))

describe('useBillingReturnRefresh', () => {
  async function flushPromises() {
    await act(async () => {
      await Promise.resolve()
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mocks.isConnected = true
    mocks.checkStatus.mockClear()
    mocks.clearBudget.mockClear()
    mocks.refreshBudget.mockClear()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('refreshes entitlements once on return and schedules Stripe webhook follow-ups', async () => {
    markBillingReturnRefreshPending()

    renderHook(() => useBillingReturnRefresh())

    expect(mocks.checkStatus).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(mocks.clearBudget).toHaveBeenCalledTimes(1)
    expect(mocks.refreshBudget).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(mocks.checkStatus).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(mocks.clearBudget).toHaveBeenCalledTimes(2)
    expect(mocks.refreshBudget).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(8000)
    })

    expect(mocks.checkStatus).toHaveBeenCalledTimes(3)
    await flushPromises()
    expect(mocks.clearBudget).toHaveBeenCalledTimes(3)
    expect(mocks.refreshBudget).toHaveBeenCalledTimes(3)
  })

  it('does not refresh on ordinary focus when no billing return is pending', () => {
    renderHook(() => useBillingReturnRefresh())

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mocks.clearBudget).not.toHaveBeenCalled()
    expect(mocks.checkStatus).not.toHaveBeenCalled()
    expect(mocks.refreshBudget).not.toHaveBeenCalled()
  })

  it('lets the billing success URL handler own direct checkout returns', () => {
    const url = new URL(window.location.href)
    url.searchParams.set('billing', 'success')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    markBillingReturnRefreshPending()

    renderHook(() => useBillingReturnRefresh())

    expect(mocks.checkStatus).not.toHaveBeenCalled()
    expect(mocks.clearBudget).not.toHaveBeenCalled()
    expect(mocks.refreshBudget).not.toHaveBeenCalled()
  })

  it('allows another billing return after a later checkout click in the same app session', async () => {
    const { unmount } = renderHook(() => useBillingReturnRefresh())

    markBillingReturnRefreshPending()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mocks.checkStatus).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(mocks.refreshBudget).toHaveBeenCalledTimes(1)

    markBillingReturnRefreshPending()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mocks.checkStatus).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(mocks.refreshBudget).toHaveBeenCalledTimes(2)

    unmount()
  })
})
