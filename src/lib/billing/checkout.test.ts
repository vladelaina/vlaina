import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hasElectronDesktopBridgeMock, createElectronBillingCheckoutMock } = vi.hoisted(() => ({
  hasElectronDesktopBridgeMock: vi.fn(),
  createElectronBillingCheckoutMock: vi.fn(),
}))

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: hasElectronDesktopBridgeMock,
  createElectronBillingCheckout: createElectronBillingCheckoutMock,
}))

function mockLocation(url: string) {
  vi.spyOn(window, 'location', 'get').mockReturnValue(new URL(url) as unknown as Location)
}

describe('billing checkout requests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    hasElectronDesktopBridgeMock.mockReset()
    createElectronBillingCheckoutMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  it('times out billing plan requests when fetch ignores cancellation', async () => {
    vi.useFakeTimers()
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined
      return new Promise(() => undefined)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBillingPlans } = await import('./checkout')
    const request = fetchBillingPlans()
    const expectation = expect(request).rejects.toThrow('Billing API request timed out.')

    await vi.advanceTimersByTimeAsync(15_000)

    await expectation
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out billing plan JSON parsing when the response body hangs', async () => {
    vi.useFakeTimers()
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(() => new Promise(() => undefined)),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBillingPlans } = await import('./checkout')
    const request = fetchBillingPlans()
    const expectation = expect(request).rejects.toThrow('Billing API request timed out.')

    await vi.advanceTimersByTimeAsync(15_000)

    await expectation
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out browser checkout requests when fetch ignores cancellation', async () => {
    vi.useFakeTimers()
    hasElectronDesktopBridgeMock.mockReturnValue(false)
    mockLocation('https://vlaina.com/pricing')
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined
      return new Promise(() => undefined)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { createBillingCheckout } = await import('./checkout')
    const request = createBillingCheckout('pro')
    const expectation = expect(request).rejects.toThrow('Billing API request timed out.')

    await vi.advanceTimersByTimeAsync(15_000)

    await expectation
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
