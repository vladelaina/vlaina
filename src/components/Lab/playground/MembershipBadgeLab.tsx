import { useState } from 'react';
import { cn } from '@/lib/utils';
import { membershipBadgeVariants, type MembershipBadgeTone, type MembershipBadgeVariant } from '../variants/membershipBadgeVariants';

const sampleTiers: Array<{ tone: MembershipBadgeTone; name: string; subtitle: string }> = [
  { tone: 'free', name: 'Free', subtitle: 'Default access' },
  { tone: 'plus', name: 'Pro', subtitle: 'More monthly points' },
  { tone: 'pro', name: 'MAX', subtitle: 'Higher model access' },
  { tone: 'max', name: 'Ultra', subtitle: 'Top priority' },
];

function MembershipBadgePreview({ variant, dark }: { variant: MembershipBadgeVariant; dark: boolean }) {
  return (
    <div
      className={cn(
        'w-full max-w-[420px] rounded-[36px] p-6 transition-colors duration-500',
        variant.stageClassName,
        dark && 'bg-[radial-gradient(circle_at_top,#2a2a30,#0c0c0f_72%)]'
      )}
    >
      <div
        className={cn(
          variant.shellClassName,
          dark && 'border-white/10 bg-zinc-950 text-white shadow-[0_24px_52px_rgba(0,0,0,0.42)]'
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className={cn('text-[10px] font-black uppercase tracking-[0.22em]', variant.headerClassName, dark && 'text-zinc-600')}>
              Membership Display
            </div>
            <div className={cn('mt-2 text-[18px] font-black tracking-[-0.03em] text-zinc-950', dark && 'text-white')}>
              User tier surface
            </div>
          </div>
          <div className={cn('rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] bg-zinc-100 text-zinc-500', dark && 'bg-white/5 text-zinc-400')}>
            4 tiers
          </div>
        </div>

        <div className={cn('flex flex-col', variant.listClassName)}>
          {sampleTiers.map((item) => (
            <div key={item.tone} className={cn('flex items-center justify-between gap-3', variant.itemClassName, dark && 'border-white/10 bg-white/[0.03]')}>
              <div className="min-w-0">
                <div className={cn('text-[12px] font-semibold', variant.labelClassName, dark && 'text-zinc-400')}>
                  {item.subtitle}
                </div>
                <div className={cn('mt-1 text-[16px] font-black tracking-[-0.03em] text-zinc-950', dark && 'text-white')}>
                  {item.name}
                </div>
              </div>
              <span className={cn('shrink-0', variant.valueClassName, variant.accentStyle[item.tone])}>{item.name}</span>
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
    <div className={cn('mx-auto flex max-w-[1680px] flex-col gap-14 pb-32 transition-colors duration-500', viewMode === 'dark' && 'dark')}>
      <div className="flex flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="max-w-3xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            Tier Display Directions
          </div>
          <h2 className="mt-4 text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
            Membership Badge Lab
          </h2>
          <p className="mt-4 text-[17px] font-medium text-zinc-500 dark:text-zinc-400">
            Thirty directions for showing Free, Pro, MAX, and Ultra without the current heavy-handed look.
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
            <div className="flex items-center gap-3 px-2">
              <span className="text-[11px] font-black text-zinc-300 dark:text-zinc-700">#{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{variant.name}</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {variant.category}
                  </span>
                </div>
              </div>
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
