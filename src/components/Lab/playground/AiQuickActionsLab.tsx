import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import {
  AI_QUICK_ACTION_PROMPT,
  AI_QUICK_ACTION_SAMPLE_ACTIONS,
  AI_QUICK_ACTION_SELECTION_TEXT,
  AI_QUICK_ACTION_VARIANTS,
  type AiQuickActionVariant,
} from '../variants/aiQuickActionVariants';

function renderActions(variant: AiQuickActionVariant) {
  const actionNode = (label: string, index: number, extraClassName?: string) => (
    <button
      key={`${variant.id}-${label}`}
      type="button"
      className={cn(
        'inline-flex items-center gap-2 transition-all duration-200',
        variant.actionClassName,
        index === 0 ? variant.featuredActionClassName : variant.secondaryActionClassName,
        extraClassName
      )}
    >
      <span>{label}</span>
    </button>
  );

  if (variant.layout === 'grid') {
    return (
      <div className={variant.actionsClassName}>
        {AI_QUICK_ACTION_SAMPLE_ACTIONS.map((label, index) => actionNode(label, index))}
      </div>
    );
  }

  if (variant.layout === 'stack') {
    return (
      <div className={variant.actionsClassName}>
        {AI_QUICK_ACTION_SAMPLE_ACTIONS.map((label, index) =>
          actionNode(
            label,
            index,
            'w-full justify-between after:text-[11px] after:opacity-50 after:content-["↗"]'
          )
        )}
      </div>
    );
  }

  if (variant.layout === 'split') {
    const [first, ...rest] = AI_QUICK_ACTION_SAMPLE_ACTIONS;

    return (
      <div className={variant.actionsClassName}>
        {actionNode(first, 0, 'w-full justify-between')}
        <div className="grid grid-cols-2 gap-2">
          {rest.map((label, index) => actionNode(label, index + 1, 'justify-center'))}
        </div>
      </div>
    );
  }

  return (
    <div className={variant.actionsClassName}>
      {AI_QUICK_ACTION_SAMPLE_ACTIONS.map((label, index) => actionNode(label, index))}
    </div>
  );
}

function AiQuickActionPreview({ variant, index }: { variant: AiQuickActionVariant; index: number }) {
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
        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500', variant.labelClassName)}>
          {variant.layout}
        </span>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-[24px] p-6 sm:p-7',
          variant.surfaceClassName
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-[460px] rounded-[26px] p-3.5',
            variant.panelClassName,
            variant.fontClassName
          )}
        >
          <div className={cn('rounded-[18px] px-3.5 py-3', variant.selectionShellClassName)}>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              <span>Selected</span>
              <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
              <span>62 chars</span>
            </div>
            <p className={cn('mt-2 text-[13px] leading-6 tracking-[-0.01em]', variant.selectionTextClassName)}>
              {AI_QUICK_ACTION_SELECTION_TEXT}
            </p>
          </div>

          <div className={cn('mt-3 flex items-center gap-3 rounded-[20px] px-3.5 py-3', variant.inputShellClassName)}>
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5',
                variant.iconClassName
              )}
            >
              <Icon name="common.sparkle" size="sm" />
            </span>

            <span
              className={cn(
                'hidden rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline-flex',
                variant.scopeClassName
              )}
            >
              Edit
            </span>

            <div className="min-w-0 flex-1">
              <div className={cn('truncate', variant.promptClassName)}>{AI_QUICK_ACTION_PROMPT}</div>
            </div>

            <button
              type="button"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 hover:scale-[1.04]',
                variant.sendButtonClassName
              )}
            >
              <Icon name="common.send" size="sm" />
            </button>
          </div>

          {renderActions(variant)}
        </div>
      </div>
    </div>
  );
}

export function AiQuickActionsLab() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Quick Actions Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          30 directions for editing the selected text with AI
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          These are no longer chat-input skins. Every variant now starts from the same product model: selected text first, command second, presets as edit operations, and a floating surface that still feels native to a document editor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {AI_QUICK_ACTION_VARIANTS.map((variant, index) => (
          <AiQuickActionPreview key={variant.id} variant={variant} index={index} />
        ))}
      </div>
    </div>
  );
}
