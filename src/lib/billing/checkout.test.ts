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

function billingJsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
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
        .mockResolvedValueOnce(billingJsonResponse({
            success: true,
            checkoutEnabled: true,
            plans: [{ tier: 'pro', displayName: 'Pro', monthlyPoints: 100, planPriceMicrounits: 1000, priceUsd: 1 }],
          }))
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
    const reader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => reader,
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBillingPlans } = await import('./checkout')
    const request = fetchBillingPlans()
    const expectation = expect(request).rejects.toThrow('Billing API request timed out.')

    await vi.advanceTimersByTimeAsync(0)
    expect(reader.read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)

    await expectation
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reader.cancel).toHaveBeenCalledTimes(1)
    expect(reader.releaseLock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds oversized billing response bodies', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(64 * 1024 + 1)))
        },
        cancel,
      }),
      { status: 200 }
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const { fetchBillingPlans } = await import('./checkout')

    await expect(fetchBillingPlans()).rejects.toThrow('Billing API response body is too large.')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(() => response.body?.getReader()).not.toThrow()
  })

  it('bounds declared oversized billing response bodies', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({ cancel }),
      {
        status: 200,
        headers: {
          'content-length': String(64 * 1024 + 1),
        },
      }
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const { fetchBillingPlans } = await import('./checkout')

    await expect(fetchBillingPlans()).rejects.toThrow('Billing API response body is too large.')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(() => response.body?.getReader()).not.toThrow()
  })

  it('ignores invalid billing content-length syntax', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(billingJsonResponse({
      success: true,
      checkoutEnabled: true,
      plans: [{ tier: 'pro', displayName: 'Pro', monthlyPoints: 100, planPriceMicrounits: 1000, priceUsd: 1 }],
    }, {
      headers: { 'content-length': '1e12' },
    })))

    const { fetchBillingPlans } = await import('./checkout')

    await expect(fetchBillingPlans()).resolves.toMatchObject({
      checkoutEnabled: true,
      plans: [{ tier: 'pro' }],
    })
  })

  it('uses the HTTP fallback when billing error response bodies are oversized', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(64 * 1024 + 1)))
        },
        cancel,
      }),
      { status: 500 }
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const { fetchBillingPlans } = await import('./checkout')

    await expect(fetchBillingPlans()).rejects.toThrow('Failed to load membership plans: HTTP 500')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(() => response.body?.getReader()).not.toThrow()
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

  it('normalizes browser checkout URLs before returning them', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false)
    mockLocation('https://vlaina.com/pricing')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(billingJsonResponse({
      success: true,
      url: ' https://checkout.stripe.com/pay/cs_test?client_reference_id=vlaina ',
    })))

    const { createBillingCheckout } = await import('./checkout')

    await expect(createBillingCheckout('pro')).resolves.toBe(
      'https://checkout.stripe.com/pay/cs_test?client_reference_id=vlaina'
    )
  })

  it('rejects oversized checkout URLs before trimming them', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true)
    createElectronBillingCheckoutMock.mockResolvedValue({
      success: true,
      url: `${' '.repeat(4097)}https://checkout.stripe.com/pay/cs_test`,
    })

    const { createBillingCheckout } = await import('./checkout')

    await expect(createBillingCheckout('pro')).rejects.toThrow('Failed to create checkout session')
  })

  it.each([
    ['non-HTTP URL', 'mailto:billing@example.com'],
    ['credentialed URL', 'https://user:pass@checkout.stripe.com/pay/cs_test'],
    ['local-network URL', 'http://127.0.0.1:8080/pay'],
    ['backslash URL', String.raw`https://checkout.stripe.com\@evil.example/pay`],
  ])('rejects unsafe %s from checkout responses', async (_label, url) => {
    hasElectronDesktopBridgeMock.mockReturnValue(false)
    mockLocation('https://vlaina.com/pricing')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(billingJsonResponse({
      success: true,
      url,
    })))

    const { createBillingCheckout } = await import('./checkout')

    await expect(createBillingCheckout('pro')).rejects.toThrow('Failed to create checkout session')
  })
})
