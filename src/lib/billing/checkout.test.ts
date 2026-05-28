import { beforeEach, describe, expect, it, vi } from 'vitest'

const { hasElectronDesktopBridgeMock, createElectronBillingCheckoutMock } = vi.hoisted(() => ({
  hasElectronDesktopBridgeMock: vi.fn(),
  createElectronBillingCheckoutMock: vi.fn(),
}))

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: hasElectronDesktopBridgeMock,
  createElectronBillingCheckout: createElectronBillingCheckoutMock,
}))

describe('billing checkout requests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    hasElectronDesktopBridgeMock.mockReset()
    createElectronBillingCheckoutMock.mockReset()
  })

  it('retries quickly failed read-only billing plan requests once', async () => {
    vi.useFakeTimers()
    try {
      hasElectronDesktopBridgeMock.mockReturnValue(true)
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            checkoutEnabled: true,
            plans: [{ tier: 'pro', displayName: 'Pro', monthlyPoints: 100, planPriceMicrounits: 1000, priceUsd: 1 }],
          }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const { fetchBillingPlans } = await import('./checkout')
      const request = fetchBillingPlans()

      await vi.advanceTimersByTimeAsync(300)

      await expect(request).resolves.toMatchObject({
        checkoutEnabled: true,
        plans: [{ tier: 'pro' }],
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
