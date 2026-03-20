import { Icon } from '@/components/ui/icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { googleButtonVariants, type GoogleButtonVariant } from '../variants/googleButtonVariants';

function ButtonPreview({ variant }: { variant: GoogleButtonVariant }) {
  return (
    <div
      className={cn(
        'w-full max-w-[380px] rounded-[44px] border border-white/70 bg-white p-8 shadow-[0_32px_80px_rgba(15,23,42,0.08)] transition-all duration-500 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_32px_90px_rgba(0,0,0,0.4)]'
      )}
    >
      <div className="mb-6 text-center">
        <h4 className="text-[12px] font-black uppercase tracking-[0.18em] text-zinc-300 dark:text-zinc-600">
          Motion Study
        </h4>
      </div>

      <button
        type="button"
        className={cn(
          'group relative w-full cursor-pointer overflow-hidden rounded-[24px] transition-all duration-500 ease-out',
          variant.surfaceClass,
          variant.motionClass
        )}
      >
        <div className="lab-halo pointer-events-none absolute inset-[-18%] scale-90 rounded-[32px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(66,133,244,0.22),rgba(234,67,53,0.18),rgba(251,188,5,0.18),rgba(52,168,83,0.22),rgba(66,133,244,0.22))] opacity-0 blur-2xl transition-all duration-500" />
        <div className="lab-fill pointer-events-none absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-[#4285F4]/8 via-white/0 to-[#34A853]/8 transition-transform duration-500" />
        <div className="lab-fill-center pointer-events-none absolute inset-y-0 left-1/2 w-[68%] -translate-x-1/2 origin-center scale-x-0 rounded-full bg-gradient-to-r from-[#4285F4]/10 via-[#FBBC05]/8 to-[#34A853]/10 transition-transform duration-500" />
        <div className="lab-mask pointer-events-none absolute inset-y-0 left-[-30%] w-[28%] -skew-x-12 bg-white/45 transition-transform duration-700" />
        <div className="lab-shine pointer-events-none absolute inset-y-0 left-[-32%] w-[24%] -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700" />
        <div className="lab-corner pointer-events-none absolute right-2 top-2 h-8 w-8 scale-75 rounded-full bg-gradient-to-br from-white/90 to-[#4285F4]/25 opacity-0 blur-[2px] transition-all duration-500" />
        <div
          className={cn(
            'lab-thread pointer-events-none absolute inset-x-8 top-0 h-[2px] origin-left scale-x-0 opacity-0 transition-all duration-500',
            variant.accentClass || 'bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853]'
          )}
        />
        <div
          className={cn(
            'lab-accent pointer-events-none absolute inset-x-6 bottom-0 h-[3px] origin-left scale-x-0 opacity-70 transition-transform duration-500',
            variant.accentClass || 'bg-zinc-950'
          )}
        />

        <div className="lab-surface relative flex h-14 items-center justify-between gap-3 px-4 sm:h-[58px] sm:px-5 transition-all duration-500 ease-out">
          <div className="lab-content flex min-w-0 items-center gap-3 transition-all duration-500 ease-out">
            <div
              className={cn(
                'lab-google flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500 ease-out',
                variant.iconWrapClass
              )}
            >
              <Icon name="common.google" size={18} />
            </div>
            <span
              className={cn(
                'lab-copy truncate text-[14px] font-black tracking-tight opacity-95 transition-all duration-500 ease-out',
                variant.textClass
              )}
            >
              Continue with Google
            </span>
          </div>

          <div className="lab-right flex shrink-0 items-center transition-all duration-500 ease-out">
            <Icon
              name="nav.arrowRight"
              size="sm"
              className="lab-arrow opacity-55 transition-all duration-500 ease-out"
            />
          </div>
        </div>
      </button>

      <div className="mt-6 space-y-3 opacity-20">
        <div className="h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export function GoogleButtonLab() {
  const [viewMode, setViewMode] = useState<'light' | 'dark'>('light');

  return (
    <div
      className={cn(
        'mx-auto flex max-w-[1600px] flex-col gap-14 pb-32 transition-colors duration-500',
        viewMode === 'dark' && 'dark'
      )}
    >
      <div className="flex flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="max-w-3xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Motion Directions
          </div>
          <h2 className="mt-4 text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
            Google Button Motion Lab
          </h2>
          <p className="mt-4 text-[17px] font-medium text-zinc-500 dark:text-zinc-400">
            Thirty interaction studies focused on hover, pull, reveal, and depth. Same core silhouette, different motion language.
          </p>
        </div>

        <div className="flex items-center rounded-2xl border border-zinc-200 bg-zinc-100 p-1.5 shadow-inner dark:border-zinc-700 dark:bg-zinc-800">
          <button
            onClick={() => setViewMode('light')}
            className={cn(
              'rounded-xl px-6 py-2 text-xs font-black transition-all',
              viewMode === 'light' ? 'bg-white text-zinc-950 shadow-md' : 'text-zinc-500'
            )}
          >
            Light
          </button>
          <button
            onClick={() => setViewMode('dark')}
            className={cn(
              'rounded-xl px-6 py-2 text-xs font-black transition-all',
              viewMode === 'dark'
                ? 'border border-white/5 bg-zinc-900 text-white shadow-md'
                : 'text-zinc-500'
            )}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 px-6 md:grid-cols-2 xl:grid-cols-3">
        {googleButtonVariants.map((variant, index) => (
          <div key={variant.id} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <span className="text-[11px] font-black text-zinc-300 dark:text-zinc-700">
                #{String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    {variant.name}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {variant.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden rounded-[44px] border border-zinc-200/70 bg-[radial-gradient(circle_at_top,#ffffff, #f7f8fb_58%)] p-6 transition-all dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top,#141414,#0a0a0a_58%)]">
              <ButtonPreview variant={variant} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
