import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icons'
import { createBillingCheckout, fetchBillingPlans, type BillingPlan } from '@/lib/billing/checkout'
import { openExternalHref } from '@/lib/navigation/externalLinks'
import { hasBackendCommands } from '@/lib/tauri/invoke'
import { cn } from '@/lib/utils'
import { useAccountSessionStore } from '@/stores/accountSession'
import { useToastStore } from '@/stores/useToastStore'

interface BillingPlansDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatUsdPrice(value: number): string {
  return `$${value.toFixed(Number.isInteger(value) ? 0 : 2)}`
}

function planAccentClass(tier: BillingPlan['tier']): string {
  if (tier === 'plus') {
    return 'border-sky-200/80 bg-sky-50/70 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200'
  }

  if (tier === 'pro') {
    return 'border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200'
  }

  return 'border-amber-200/80 bg-amber-50/70 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200'
}

function planButtonClass(tier: BillingPlan['tier']): string {
  if (tier === 'plus') {
    return 'bg-sky-500 text-white hover:bg-sky-600 disabled:bg-sky-200 disabled:text-sky-700 dark:disabled:bg-sky-500/30 dark:disabled:text-sky-100/80'
  }

  if (tier === 'pro') {
    return 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-200 disabled:text-emerald-700 dark:disabled:bg-emerald-500/30 dark:disabled:text-emerald-100/80'
  }

  return 'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200 disabled:text-amber-700 dark:disabled:bg-amber-500/30 dark:disabled:text-amber-100/80'
}

export function BillingPlansDialog({ open, onOpenChange }: BillingPlansDialogProps) {
  const membershipTier = useAccountSessionStore((state) => state.membershipTier)
  const membershipName = useAccountSessionStore((state) => state.membershipName)
  const addToast = useToastStore((state) => state.addToast)

  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [checkoutEnabled, setCheckoutEnabled] = useState(false)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isStartingTier, setIsStartingTier] = useState<BillingPlan['tier'] | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setIsLoadingPlans(true)
    setLoadError(null)

    void fetchBillingPlans()
      .then((result) => {
        if (cancelled) {
          return
        }

        setPlans(result.plans)
        setCheckoutEnabled(result.checkoutEnabled)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        setLoadError(message || 'Failed to load membership plans')
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPlans(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const currentPlanLabel = membershipName || (membershipTier === 'free' ? 'Free' : null)
  const checkoutButtonLabel = hasBackendCommands() ? 'Open in Browser' : 'Continue to Checkout'

  const handleCheckout = async (plan: BillingPlan) => {
    if (isStartingTier) {
      return
    }

    setIsStartingTier(plan.tier)
    try {
      const checkoutUrl = await createBillingCheckout(plan.tier)

      if (hasBackendCommands()) {
        await openExternalHref(checkoutUrl)
        addToast('Stripe checkout opened in your browser.', 'info', 4500)
        onOpenChange(false)
        return
      }

      window.location.assign(checkoutUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addToast(message || 'Failed to open checkout', 'error', 4500)
    } finally {
      setIsStartingTier(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        useBlurBackdrop
        blurBackdropProps={{
          overlayClassName: 'bg-white/20 dark:bg-white/6',
          blurPx: 8,
        }}
        className="max-w-[920px] overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#111214] dark:shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-zinc-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(251,191,36,0.10),rgba(255,255,255,0.94))] px-7 py-6 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(245,158,11,0.12),rgba(17,18,20,0.96))]">
          <DialogHeader className="gap-3 text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Icon name="misc.crown" size="sm" />
              Membership
            </div>
            <DialogTitle className="text-[30px] font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
              {currentPlanLabel ? `${currentPlanLabel} is active on this account` : 'Choose a membership plan'}
            </DialogTitle>
            <DialogDescription className="max-w-[620px] text-[14px] leading-6 text-zinc-600 dark:text-zinc-400">
              {hasBackendCommands()
                ? 'Checkout opens in your default browser. After payment, your membership syncs back to the app automatically.'
                : 'Choose a plan and continue to Stripe checkout.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-7 py-7">
          {isLoadingPlans ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/80 text-[14px] text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
              Loading membership plans...
            </div>
          ) : loadError ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-[24px] border border-rose-200/80 bg-rose-50/70 px-6 text-center dark:border-rose-400/20 dark:bg-rose-500/10">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm dark:bg-white/10 dark:text-rose-200">
                <Icon name="common.warning" size="md" />
              </div>
              <div className="max-w-[420px] text-[14px] leading-6 text-rose-700 dark:text-rose-200">{loadError}</div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-300/20 dark:bg-white/5 dark:text-rose-100 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/80 text-[14px] text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
              No paid plans are available yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrentPlan = membershipTier === plan.tier
                const isStarting = isStartingTier === plan.tier

                return (
                  <div
                    key={plan.tier}
                    className={cn(
                      'flex min-h-[280px] flex-col rounded-[28px] border bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5 dark:bg-[#17181b] dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]',
                      isCurrentPlan
                        ? 'border-zinc-900/12 ring-1 ring-zinc-900/8 dark:border-white/14 dark:ring-white/10'
                        : 'border-zinc-200/70 dark:border-white/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">{plan.displayName}</div>
                        <div className="mt-2 flex items-end gap-1 text-zinc-950 dark:text-zinc-50">
                          <span className="text-[34px] font-semibold tracking-[-0.05em]">{formatUsdPrice(plan.priceUsd)}</span>
                          <span className="pb-1 text-[13px] text-zinc-500 dark:text-zinc-400">/ month</span>
                        </div>
                      </div>
                      <div className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', planAccentClass(plan.tier))}>
                        {isCurrentPlan ? 'Current' : plan.tier}
                      </div>
                    </div>

                    <div className="mt-5 rounded-[22px] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="text-[12px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Monthly points</div>
                      <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                        {plan.monthlyPoints.toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-4 flex-1 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
                      {isCurrentPlan
                        ? 'You are already using this membership tier on the current account.'
                        : `Switch this account to ${plan.displayName} through Stripe checkout.`}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCheckout(plan)}
                      disabled={!checkoutEnabled || isStarting}
                      className={cn(
                        'mt-5 inline-flex h-12 items-center justify-center rounded-2xl px-4 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed',
                        planButtonClass(plan.tier)
                      )}
                    >
                      {isStarting ? 'Opening...' : checkoutEnabled ? checkoutButtonLabel : 'Unavailable'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
