import { createElectronBillingCheckout, hasElectronDesktopBridge } from '@/lib/desktop/backend'

const API_BASE = 'https://api.vlaina.com'
const BILLING_GET_RETRY_DELAYS_MS = [300]
const BILLING_FAST_FAILURE_RETRY_WINDOW_MS = 2000

export type BillingPlanTier = 'plus' | 'pro' | 'max' | 'ultra'

export interface BillingPlan {
  tier: BillingPlanTier
  displayName: string
  monthlyPoints: number
  planPriceMicrounits: number
  priceUsd: number
}

interface BillingPlansResponse {
  success: boolean
  checkoutEnabled?: boolean
  plans?: BillingPlan[]
  error?: string
}

interface BillingCheckoutResponse {
  success: boolean
  url?: string
  error?: string
}

function isSupportedBillingOrigin(): boolean {
  if (typeof window === 'undefined' || hasElectronDesktopBridge()) {
    return true
  }

  const hostname = window.location.hostname.trim().toLowerCase()
  if (!hostname) {
    return true
  }

  return hostname === 'vlaina.com' || hostname.endsWith('.vlaina.com')
}

function assertSupportedBillingOrigin(): void {
  if (!isSupportedBillingOrigin()) {
    throw new Error('Membership checkout is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.')
  }
}

async function readJsonErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
  } catch {
  }

  return fallback
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function delayBillingRetry(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchReadOnlyBilling(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now()
    try {
      return await fetch(url, init)
    } catch (error) {
      const retryDelayMs = BILLING_GET_RETRY_DELAYS_MS[attempt]
      const failedQuickly = Date.now() - startedAt <= BILLING_FAST_FAILURE_RETRY_WINDOW_MS
      if (isAbortError(error) || retryDelayMs == null || !failedQuickly) {
        throw error
      }
      await delayBillingRetry(retryDelayMs)
    }
  }
}

function normalizeCheckoutUrl(data: BillingCheckoutResponse | null | undefined): string {
  const url = typeof data?.url === 'string' ? data.url.trim() : ''
  if (!data?.success || !url) {
    throw new Error(data?.error || 'Failed to create checkout session')
  }
  return url
}

export async function fetchBillingPlans(): Promise<{
  checkoutEnabled: boolean
  plans: BillingPlan[]
}> {
  assertSupportedBillingOrigin()

  const response = await fetchReadOnlyBilling(`${API_BASE}/billing/plans`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(await readJsonErrorMessage(response, `Failed to load membership plans: HTTP ${response.status}`))
  }

  const data = (await response.json()) as BillingPlansResponse
  return {
    checkoutEnabled: data.checkoutEnabled === true,
    plans: Array.isArray(data.plans) ? data.plans : [],
  }
}

export async function createBillingCheckout(tier: BillingPlanTier): Promise<string> {
  if (hasElectronDesktopBridge()) {
    const data = await createElectronBillingCheckout(tier) as BillingCheckoutResponse
    return normalizeCheckoutUrl(data)
  }

  assertSupportedBillingOrigin()

  const response = await fetch(`${API_BASE}/billing/checkout`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tier }),
  })

  if (!response.ok) {
    throw new Error(await readJsonErrorMessage(response, `Failed to create checkout session: HTTP ${response.status}`))
  }

  const data = (await response.json()) as BillingCheckoutResponse
  return normalizeCheckoutUrl(data)
}
