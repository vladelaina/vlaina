import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { membershipBadgeVariants, type MembershipBadgeTone, type MembershipBadgeVariant } from '../variants/membershipBadgeVariants';

const sampleTiers: Array<{ tone: MembershipBadgeTone; name: string; subtitle: string }> = [
  { tone: 'free', name: 'Mika Tan', subtitle: 'Starter access' },
  { tone: 'plus', name: 'Aki Ren', subtitle: 'Monthly boost enabled' },
  { tone: 'pro', name: 'Yuna Park', subtitle: 'Advanced model access' },
  { tone: 'max', name: 'Sora Vale', subtitle: 'Priority lane enabled' },
];

function MembershipCrownBadge({
  variant,
  tone,
}: {
  variant: MembershipBadgeVariant;
  tone: MembershipBadgeTone;
}) {
  const style = variant.tierStyles[tone];

  return (
    <div className={cn('pointer-events-none', variant.badgeWrapClassName)}>
      <span className={cn(variant.haloBaseClassName, style.haloClassName)} />
      <span className={cn(variant.backBaseClassName, style.backClassName)} />
      <span className={cn(variant.orbitBaseClassName, style.orbitClassName)} />
      <span className={cn(variant.dotBaseClassName, style.dotClassName)} />
      <span className={cn(variant.coreBaseClassName, style.coreClassName)}>
        <Icon
          name="misc.crown"
          size={15}
          strokeWidth={style.crownStrokeWidth}
          className={cn(style.crownClassName)}
        />
      </span>
    </div>
  );
}

function MembershipBadgePreview({ variant, dark }: { variant: MembershipBadgeVariant; dark: boolean }) {
  return (
    <div
      className={cn(
        'w-full max-w-[430px] rounded-[38px] p-6 transition-colors duration-500',
        variant.stageClassName,
        dark && 'bg-[radial-gradient(circle_at_top,#26262d,#09090b_74%)]'
      )}
    >
      <div
        className={cn(
          variant.shellClassName,
          dark && 'border-white/10 bg-zinc-950 text-white shadow-[0_28px_60px_rgba(0,0,0,0.42)]'
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                variant.eyebrowClassName,
                dark && 'bg-white/8 text-zinc-300'
              )}
            >
              Crown-Only Signal
            </div>
            <div className={cn('mt-3 text-[20px] font-black tracking-[-0.04em]', variant.identityClassName, dark && 'text-white')}>
              White roundel studies
            </div>
            <div className={cn('mt-1 text-[13px] font-medium', variant.metaClassName, dark && 'text-zinc-400')}>
              Rank meaning only comes from crown color and badge structure.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {sampleTiers.map((item) => (
            <div
              key={item.tone}
              className={cn(
                'flex items-center gap-3',
                variant.rowClassName,
                dark && 'border-white/10 bg-white/[0.03]'
              )}
            >
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border text-[15px] font-black',
                    variant.avatarClassName,
                    dark && 'border-white/10 bg-white/[0.06] text-white'
                  )}
                >
                  {item.name.slice(0, 1)}
                </div>
                <MembershipCrownBadge variant={variant} tone={item.tone} />
              </div>

              <div className="min-w-0">
                <div className={cn('truncate text-[14px] font-black', variant.identityClassName, dark && 'text-white')}>
                  {item.name}
                </div>
                <div className={cn('mt-1 text-[12px] font-medium', variant.metaClassName, dark && 'text-zinc-400')}>
                  {item.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MembershipBadgeLab() {
  const [viewMode, setViewMode] = useState<'light' | 'dark'>('light');

  return (
    <div className={cn('mx-auto flex max-w-[1580px] flex-col gap-14 pb-32 transition-colors duration-500', viewMode === 'dark' && 'dark')}>
      <div className="flex flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="max-w-3xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:bg-white/10 dark:text-zinc-200">
            Membership Crown Studies
          </div>
          <h2 className="mt-4 text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
            White Roundel Crown Lab
          </h2>
          <p className="mt-4 text-[17px] font-medium text-zinc-500 dark:text-zinc-400">
            Five completely redrawn directions. No tier text, no capsule, only a white circular badge with different crown systems.
          </p>
        </div>

        <div className="flex items-center rounded-2xl border border-zinc-200 bg-zinc-100 p-1.5 shadow-inner dark:border-zinc-700 dark:bg-zinc-800">
          <button
            onClick={() => setViewMode('light')}
            className={cn('rounded-xl px-6 py-2 text-xs font-black transition-all', viewMode === 'light' ? 'bg-white text-zinc-950 shadow-md' : 'text-zinc-500')}
          >
            Light
          </button>
          <button
            onClick={() => setViewMode('dark')}
            className={cn('rounded-xl px-6 py-2 text-xs font-black transition-all', viewMode === 'dark' ? 'border border-white/5 bg-zinc-900 text-white shadow-md' : 'text-zinc-500')}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 px-6 md:grid-cols-2 xl:grid-cols-3">
        {membershipBadgeVariants.map((variant, index) => (
          <div key={variant.id} className="flex flex-col gap-4">
            <div className="px-2">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-zinc-300 dark:text-zinc-700">#{String(index + 1).padStart(2, '0')}</span>
                <h3 className="truncate text-[15px] font-black text-zinc-900 dark:text-zinc-100">{variant.name}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {variant.category}
                </span>
              </div>
              <p className="mt-2 pl-8 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{variant.description}</p>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden rounded-[44px] border border-zinc-200/70 bg-[radial-gradient(circle_at_top,#ffffff,#f7f8fb_58%)] p-6 transition-all dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top,#141414,#0a0a0a_58%)]">
              <MembershipBadgePreview variant={variant} dark={viewMode === 'dark'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
