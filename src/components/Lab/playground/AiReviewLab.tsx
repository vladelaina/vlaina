import { cn } from '@/lib/utils';
import {
  AI_REVIEW_ACTION,
  AI_REVIEW_AFTER_TEXT,
  AI_REVIEW_BEFORE_TEXT,
  AI_REVIEW_VARIANTS,
  type AiReviewVariant,
} from '../variants/aiReviewVariants';

function ReviewBody({ variant }: { variant: AiReviewVariant }) {
  const beforeCard = (
    <section className={cn('rounded-[18px] p-4', variant.beforeCardClassName)}>
      <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', variant.labelClassName)}>
        Before
      </div>
      <p className={cn('mt-3 text-[13px] leading-6 tracking-[-0.01em]', variant.beforeTextClassName)}>
        {AI_REVIEW_BEFORE_TEXT}
      </p>
    </section>
  );

  const afterCard = (
    <section className={cn('rounded-[18px] p-4', variant.afterCardClassName)}>
      <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', variant.labelClassName)}>
        After
      </div>
      <p className={cn('mt-3 text-[13px] leading-6 tracking-[-0.01em]', variant.afterTextClassName)}>
        {AI_REVIEW_AFTER_TEXT}
      </p>
    </section>
  );

  if (variant.layout === 'parallel') {
    return <div className={variant.bodyClassName}>{beforeCard}{afterCard}</div>;
  }

  if (variant.layout === 'spotlight') {
    return (
      <div className={variant.bodyClassName}>
        <div className="max-w-[72%]">{beforeCard}</div>
        <div>{afterCard}</div>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-2', variant.bodyClassName)}>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        {beforeCard}
        {afterCard}
      </div>
    </div>
  );
}

function AiReviewVariantPreview({ variant, index }: { variant: AiReviewVariant; index: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-mono font-bold text-neutral-500">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-neutral-900">{variant.name}</h3>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">{variant.description}</p>
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {variant.layout}
        </span>
      </div>

      <div className={cn('relative overflow-hidden rounded-[24px] p-6 sm:p-7', variant.surfaceClassName)}>
        <div className={cn('pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-gradient-to-r blur-3xl', variant.accentClassName)} />
        <div
          className={cn(
            'relative mx-auto w-full max-w-[480px] overflow-hidden rounded-[26px]',
            variant.panelClassName,
            variant.fontClassName
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
            <div className="min-w-0">
              <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', variant.badgeClassName)}>
                AI Suggestion
              </span>
              <h4 className={cn('mt-3 text-[18px] font-semibold tracking-[-0.03em]', variant.titleClassName)}>
                Review the edit before applying it
              </h4>
              <p className={cn('mt-1 text-[12px] leading-6', variant.metaClassName)}>
                {AI_REVIEW_ACTION}
              </p>
            </div>
            <div className={cn('mt-0.5 hidden rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline-flex', variant.badgeClassName)}>
              Pending
            </div>
          </div>

          <div className="px-5 pb-5">
            <ReviewBody variant={variant} />
          </div>

          <div className={cn('flex flex-wrap items-center justify-end gap-2 px-5 pb-5 pt-4', variant.footerClassName)}>
            <button type="button" className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', variant.tertiaryButtonClassName)}>
              Cancel
            </button>
            <button type="button" className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', variant.secondaryButtonClassName)}>
              Retry
            </button>
            <button type="button" className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', variant.primaryButtonClassName)}>
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiReviewLab() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Review Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          30 directions for the AI before/after approval surface
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          Every mock keeps the same product contract: original text, AI result, then three decisions. The variation is only in hierarchy, density, material, and how much visual confidence the panel projects.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {AI_REVIEW_VARIANTS.map((variant, index) => (
          <AiReviewVariantPreview key={variant.id} variant={variant} index={index} />
        ))}
      </div>
    </div>
  );
}
