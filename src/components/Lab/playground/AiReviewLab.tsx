import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AI_REVIEW_ACTIONS,
  AI_REVIEW_DIFF_TEXT,
  AI_REVIEW_MODELS,
  AI_REVIEW_SELECTED_TEXT,
  AI_REVIEW_VARIANTS,
  type AiReviewVariant,
} from '../variants/aiReviewVariants';

function getShellClasses(variant: AiReviewVariant) {
  switch (variant.shell) {
    case 'hairline':
      return 'border border-zinc-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)]';
    case 'soft':
      return 'border border-white bg-white/96 shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-sm';
    case 'floating':
      return 'border border-zinc-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]';
    case 'inset':
      return 'border border-zinc-200/80 bg-[linear-gradient(180deg,#ffffff,#fcfcfc)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_40px_rgba(15,23,42,0.05)]';
    case 'contrast':
      return 'border border-zinc-300 bg-white shadow-[0_22px_56px_rgba(24,24,27,0.1)]';
  }
}

function getCanvasClasses(variant: AiReviewVariant) {
  switch (variant.shell) {
    case 'hairline':
      return 'border border-zinc-200/80 bg-[linear-gradient(180deg,#fafafa,#f5f5f5)]';
    case 'soft':
      return 'border border-zinc-200/70 bg-[linear-gradient(180deg,#ffffff,#f7f7f8)]';
    case 'floating':
      return 'border border-zinc-200/70 bg-[linear-gradient(180deg,#fbfbfb,#f2f3f5)]';
    case 'inset':
      return 'border border-zinc-200/80 bg-[linear-gradient(180deg,#fcfcfc,#f4f4f5)]';
    case 'contrast':
      return 'border border-zinc-300/80 bg-[linear-gradient(180deg,#f5f5f5,#ececec)]';
  }
}

function getDensityClasses(variant: AiReviewVariant) {
  switch (variant.density) {
    case 'airy':
      return { panel: 'max-w-[430px]', gap: 'gap-4', padding: 'px-5 pb-5', section: 'rounded-[20px] px-4 py-4', text: 'text-[13px] leading-7' };
    case 'balanced':
      return { panel: 'max-w-[404px]', gap: 'gap-3.5', padding: 'px-4 pb-4', section: 'rounded-[18px] px-3.5 py-3.5', text: 'text-[12.5px] leading-6' };
    case 'compact':
      return { panel: 'max-w-[388px]', gap: 'gap-3', padding: 'px-4 pb-4', section: 'rounded-[17px] px-3 py-3', text: 'text-[12px] leading-6' };
    case 'dense':
      return { panel: 'max-w-[376px]', gap: 'gap-2.5', padding: 'px-3.5 pb-3.5', section: 'rounded-[16px] px-3 py-2.5', text: 'text-[12px] leading-[1.45]' };
    case 'poster':
      return { panel: 'max-w-[420px]', gap: 'gap-4', padding: 'px-5 pb-5', section: 'rounded-[22px] px-4 py-4', text: 'text-[13px] leading-7' };
    case 'calm':
      return { panel: 'max-w-[396px]', gap: 'gap-3.5', padding: 'px-4 pb-4', section: 'rounded-[18px] px-3.5 py-3.5', text: 'text-[12px] leading-[1.65]' };
  }
}

function SurfaceLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{children}</div>;
}

function SelectPill({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium',
        dark ? 'bg-zinc-950 text-white' : 'border border-zinc-200 bg-white text-zinc-700'
      )}
    >
      {children}
    </div>
  );
}

function QuietButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800">
      {children}
    </button>
  );
}

function ActionButton({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-full px-3.5 text-[12px] font-semibold transition-colors',
        strong ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
      )}
    >
      {children}
    </button>
  );
}

function ReviewSection({ children, densityClassName, subtle = false }: { children: ReactNode; densityClassName: string; subtle?: boolean }) {
  return (
    <section className={cn(densityClassName, subtle ? 'border border-zinc-200/80 bg-zinc-50/70' : 'border border-zinc-200/80 bg-white')}>
      {children}
    </section>
  );
}

function SourceText({ textClassName }: { textClassName: string }) {
  return <div className={cn('text-zinc-700', textClassName)}>{AI_REVIEW_SELECTED_TEXT}</div>;
}

function DiffText({ textClassName }: { textClassName: string }) {
  return (
    <div className={cn('text-zinc-900', textClassName)}>
      {AI_REVIEW_DIFF_TEXT.beforeStart}
      <span className="rounded px-1 text-rose-600 line-through decoration-rose-400 decoration-2">{AI_REVIEW_DIFF_TEXT.removedOne}</span>{' '}
      <span className="rounded px-1 text-emerald-700 underline decoration-emerald-500 decoration-2 underline-offset-[3px]">{AI_REVIEW_DIFF_TEXT.addedOne}</span>
      {AI_REVIEW_DIFF_TEXT.middle}
      <span className="rounded px-1 text-rose-600 line-through decoration-rose-400 decoration-2">{AI_REVIEW_DIFF_TEXT.removedTwo}</span>{' '}
      <span className="rounded px-1 text-emerald-700 underline decoration-emerald-500 decoration-2 underline-offset-[3px]">{AI_REVIEW_DIFF_TEXT.addedTwo}</span>
      {AI_REVIEW_DIFF_TEXT.end}
    </div>
  );
}

function HeaderRow({ variant }: { variant: AiReviewVariant }) {
  if (variant.header === 'minimal') {
    return (
      <div className="flex items-center justify-end gap-2 px-4 pt-4">
        <SelectPill>{AI_REVIEW_MODELS[0]}</SelectPill>
        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
      </div>
    );
  }

  if (variant.header === 'centered') {
    return (
      <div className="grid gap-3 px-4 pt-4">
        <div className="flex items-center justify-end gap-2">
          <SelectPill>{AI_REVIEW_MODELS[0]}</SelectPill>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-semibold tracking-[-0.03em] text-zinc-950">AI Review</div>
          <div className="mt-1 text-[12px] text-zinc-500">Keep the surface quiet and let the text carry the weight.</div>
        </div>
      </div>
    );
  }

  if (variant.header === 'utility') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Review</div>
        <div className="flex items-center gap-2">
          <SelectPill dark>{AI_REVIEW_MODELS[0]}</SelectPill>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
        </div>
      </div>
    );
  }

  const titleBlock = (
    <div className="min-w-0">
      <div className="text-[15px] font-semibold tracking-[-0.03em] text-zinc-950">AI Review</div>
      <div className="mt-1 text-[12px] text-zinc-500">Compare the selected text with the edited result before applying.</div>
    </div>
  );

  if (variant.header === 'split') {
    return (
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        {titleBlock}
        <div className="flex items-center gap-2">
          <SelectPill>{AI_REVIEW_MODELS[0]}</SelectPill>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
        </div>
      </div>
    );
  }

  if (variant.header === 'tight') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="text-[13px] font-semibold text-zinc-900">AI Review</div>
        <div className="flex items-center gap-2">
          <SelectPill>{AI_REVIEW_MODELS[0]}</SelectPill>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      {titleBlock}
      <div className="flex items-center gap-2">
        <SelectPill>{AI_REVIEW_MODELS[0]}</SelectPill>
        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">x</button>
      </div>
    </div>
  );
}

function ControlsRow({ variant }: { variant: AiReviewVariant }) {
  if (variant.control === 'inline') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <SelectPill dark>{AI_REVIEW_ACTIONS[0]}</SelectPill>
        <QuietButton>{AI_REVIEW_ACTIONS[1]}</QuietButton>
        <QuietButton>{AI_REVIEW_ACTIONS[2]}</QuietButton>
      </div>
    );
  }

  if (variant.control === 'segmented') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {AI_REVIEW_ACTIONS.slice(0, 3).map((action, index) => (
          <SelectPill key={action} dark={index === 0}>{action}</SelectPill>
        ))}
      </div>
    );
  }

  if (variant.control === 'stacked') {
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SelectPill dark>{AI_REVIEW_ACTIONS[0]}</SelectPill>
          <SelectPill>{AI_REVIEW_ACTIONS[3]}</SelectPill>
          <SelectPill>{AI_REVIEW_ACTIONS[4]}</SelectPill>
        </div>
        <div className="mx-auto h-9 w-full max-w-[260px] rounded-full border border-zinc-200 bg-zinc-50 px-3 text-[12px] leading-9 text-zinc-400">
          Add a follow-up instruction
        </div>
      </div>
    );
  }

  if (variant.control === 'rail') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SelectPill dark>{AI_REVIEW_ACTIONS[0]}</SelectPill>
          <QuietButton>{AI_REVIEW_ACTIONS[1]}</QuietButton>
          <QuietButton>{AI_REVIEW_ACTIONS[2]}</QuietButton>
        </div>
        <div className="text-[11px] font-medium text-zinc-400">Diff preview</div>
      </div>
    );
  }

  if (variant.control === 'compact') {
    return (
      <div className="flex items-center justify-between gap-3">
        <SelectPill dark>{AI_REVIEW_ACTIONS[0]}</SelectPill>
        <div className="text-[11px] text-zinc-400">One-step preset</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectPill dark>{AI_REVIEW_ACTIONS[0]}</SelectPill>
      <SelectPill>{AI_REVIEW_ACTIONS[1]}</SelectPill>
      <SelectPill>{AI_REVIEW_ACTIONS[2]}</SelectPill>
    </div>
  );
}

function ReviewBody({ variant, densityClassName, textClassName }: { variant: AiReviewVariant; densityClassName: string; textClassName: string }) {
  if (variant.body === 'split') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewSection densityClassName={densityClassName} subtle>
          <SurfaceLabel>Selected</SurfaceLabel>
          <div className="pt-2.5"><SourceText textClassName={textClassName} /></div>
        </ReviewSection>
        <ReviewSection densityClassName={densityClassName}>
          <SurfaceLabel>Result</SurfaceLabel>
          <div className="pt-2.5"><DiffText textClassName={textClassName} /></div>
        </ReviewSection>
      </div>
    );
  }

  if (variant.body === 'focus') {
    return (
      <div className="grid gap-3">
        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
          {AI_REVIEW_SELECTED_TEXT}
        </div>
        <ReviewSection densityClassName={densityClassName}>
          <SurfaceLabel>Preview</SurfaceLabel>
          <div className="pt-2.5"><DiffText textClassName={textClassName} /></div>
        </ReviewSection>
      </div>
    );
  }

  if (variant.body === 'editorial') {
    return (
      <div className="grid gap-2.5">
        <ReviewSection densityClassName={densityClassName} subtle>
          <SurfaceLabel>Original sentence</SurfaceLabel>
          <div className="pt-3"><SourceText textClassName={textClassName} /></div>
        </ReviewSection>
        <ReviewSection densityClassName={densityClassName}>
          <SurfaceLabel>Edited sentence</SurfaceLabel>
          <div className="pt-3"><DiffText textClassName={textClassName} /></div>
        </ReviewSection>
      </div>
    );
  }

  if (variant.body === 'thread') {
    return (
      <div className="grid gap-2.5">
        <div className="rounded-[18px] border border-zinc-200/80 bg-zinc-50/70 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Selected</div>
          <div className={cn('pt-2 text-zinc-700', textClassName)}>{AI_REVIEW_SELECTED_TEXT}</div>
        </div>
        <div className="pl-3">
          <div className="h-4 w-px bg-zinc-200" />
        </div>
        <div className="rounded-[18px] border border-zinc-200/80 bg-white px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">AI suggestion</div>
          <div className="pt-2"><DiffText textClassName={textClassName} /></div>
        </div>
      </div>
    );
  }

  if (variant.body === 'merge') {
    return (
      <div className="grid gap-3">
        <ReviewSection densityClassName={densityClassName}>
          <SurfaceLabel>Merged result</SurfaceLabel>
          <div className="pt-2.5"><DiffText textClassName={textClassName} /></div>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <div className="text-[11px] text-zinc-500">Selected text</div>
            <div className={cn('mt-1.5 text-zinc-500', textClassName)}>{AI_REVIEW_SELECTED_TEXT}</div>
          </div>
        </ReviewSection>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ReviewSection densityClassName={densityClassName} subtle>
        <SurfaceLabel>Selected</SurfaceLabel>
        <div className="pt-2.5"><SourceText textClassName={textClassName} /></div>
      </ReviewSection>
      <ReviewSection densityClassName={densityClassName}>
        <SurfaceLabel>Result</SurfaceLabel>
        <div className="pt-2.5"><DiffText textClassName={textClassName} /></div>
      </ReviewSection>
    </div>
  );
}

function FooterRow({ variant }: { variant: AiReviewVariant }) {
  if (variant.footer === 'centered') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-100 px-4 pb-4 pt-3">
        <QuietButton>Cancel</QuietButton>
        <ActionButton>Redo</ActionButton>
        <ActionButton strong>Apply</ActionButton>
      </div>
    );
  }

  if (variant.footer === 'quiet') {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 pb-4 pt-3">
        <div className="text-[11px] text-zinc-400">Preview only changes</div>
        <div className="flex items-center gap-2">
          <QuietButton>Cancel</QuietButton>
          <ActionButton strong>Apply</ActionButton>
        </div>
      </div>
    );
  }

  if (variant.footer === 'sticky') {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 pb-4 pt-3">
        <ActionButton>Redo</ActionButton>
        <ActionButton strong>Apply</ActionButton>
      </div>
    );
  }

  if (variant.footer === 'right') {
    return (
      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 pb-4 pt-3">
        <QuietButton>Cancel</QuietButton>
        <ActionButton>Redo</ActionButton>
        <ActionButton strong>Apply</ActionButton>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 pb-4 pt-3">
      <QuietButton>Cancel</QuietButton>
      <div className="flex items-center gap-2">
        <ActionButton>Redo</ActionButton>
        <ActionButton strong>Apply</ActionButton>
      </div>
    </div>
  );
}

function AiReviewVariantPreview({ variant, index }: { variant: AiReviewVariant; index: number }) {
  const density = getDensityClasses(variant);

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)]">
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
      </div>

      <div className={cn('relative overflow-hidden rounded-[24px] p-5 sm:p-6', getCanvasClasses(variant))}>
        <div
          className={cn(
            'relative mx-auto w-full overflow-hidden rounded-[26px]',
            density.panel,
            getShellClasses(variant)
          )}
        >
          <HeaderRow variant={variant} />
          <div className={cn('grid pt-3', density.gap, density.padding)}>
            <ControlsRow variant={variant} />
            <ReviewBody variant={variant} densityClassName={density.section} textClassName={density.text} />
          </div>
          <FooterRow variant={variant} />
        </div>
      </div>
    </div>
  );
}

export function AiReviewLab() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Review Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          Thirty calmer directions for the AI review surface
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          This pass resets the lab around the current product direction: monochrome, quieter hierarchy, fewer visible controls, and much stronger focus on the selected text versus the edited result.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {AI_REVIEW_VARIANTS.map((variant, index) => (
          <AiReviewVariantPreview key={variant.id} variant={variant} index={index} />
        ))}
      </div>
    </div>
  );
}
