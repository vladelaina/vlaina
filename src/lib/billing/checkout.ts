import { createElectronBillingCheckout, hasElectronDesktopBridge } from '@/lib/desktop/backend'
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity'
import {
  fetchBilling,
  fetchReadOnlyBilling,
  readBillingJson,
  readJsonErrorMessage,
  withBillingRequestTimeout,
} from './billingRequest'

const API_BASE = 'https://api.vlaina.com'
const MAX_BILLING_CHECKOUT_URL_CHARS = 4096
const BILLING_CHECKOUT_URL_UNSAFE_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i

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

function normalizeCheckoutUrl(data: BillingCheckoutResponse | null | undefined): string {
  if (!data?.success || typeof data.url !== 'string' || data.url.length > MAX_BILLING_CHECKOUT_URL_CHARS) {
    throw new Error(data?.error || 'Failed to create checkout session')
  }

  const url = data.url.trim()
  if (
    !url
    || url.length > MAX_BILLING_CHECKOUT_URL_CHARS
    || BILLING_CHECKOUT_URL_UNSAFE_CHARS_REGEX.test(url)
    || url.includes('\\')
    || !HTTP_AUTHORITY_URL_PATTERN.test(url)
  ) {
    throw new Error(data.error || 'Failed to create checkout session')
  }

  try {
    const parsed = new URL(url)
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.username
      || parsed.password
      || isLocalNetworkHttpUrl(parsed.toString())
    ) {
      throw new Error()
    }
    return parsed.toString()
  } catch {
    throw new Error(data.error || 'Failed to create checkout session')
  }
}

export async function fetchBillingPlans(): Promise<{
  checkoutEnabled: boolean
  plans: BillingPlan[]
}> {
  assertSupportedBillingOrigin()

  return await withBillingRequestTimeout(async (signal) => {
    const response = await fetchReadOnlyBilling(`${API_BASE}/billing/plans`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    }, signal)

    if (!response.ok) {
      throw new Error(await readJsonErrorMessage(response, `Failed to load membership plans: HTTP ${response.status}`, signal))
    }

    const data = await readBillingJson<BillingPlansResponse>(response, signal)
    return {
      checkoutEnabled: data.checkoutEnabled === true,
      plans: Array.isArray(data.plans) ? data.plans : [],
    }
  })
}

export async function createBillingCheckout(tier: BillingPlanTier): Promise<string> {
  if (hasElectronDesktopBridge()) {
    const data = await createElectronBillingCheckout(tier) as BillingCheckoutResponse
    return normalizeCheckoutUrl(data)
  }

  assertSupportedBillingOrigin()

  return await withBillingRequestTimeout(async (signal) => {
    const response = await fetchBilling(`${API_BASE}/billing/checkout`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier }),
    }, signal)

    if (!response.ok) {
      throw new Error(await readJsonErrorMessage(response, `Failed to create checkout session: HTTP ${response.status}`, signal))
    }

    const data = await readBillingJson<BillingCheckoutResponse>(response, signal)
    return normalizeCheckoutUrl(data)
  })
}
