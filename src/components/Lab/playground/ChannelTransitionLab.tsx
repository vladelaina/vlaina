import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Channel = {
  id: string;
  name: string;
  host: string;
  models: number;
};

type VariantConfig = {
  id: number;
  name: string;
  note: string;
  mode?: 'wait' | 'sync' | 'popLayout';
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  exit: Record<string, unknown>;
  transition: Record<string, unknown>;
  wrapperClassName?: string;
};

const CHANNELS: Channel[] = [
  { id: 'openrouter', name: 'My OpenRouter', host: 'openrouter.ai/api/v1', models: 14 },
  { id: 'azure', name: 'My Azure', host: 'azure.microsoft.com/openai', models: 8 },
  { id: 'nekotick', name: 'NekoTick', host: 'api.nekotick.com/v1', models: 21 },
];

const VARIANTS: VariantConfig[] = [
  {
    id: 1,
    name: 'Soft Fade',
    note: '只做淡入淡出，最保守。',
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 2,
    name: 'Fade + Rise',
    note: '轻微上浮，比较像精修后的默认方案。',
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 6 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 3,
    name: 'Horizontal Slide',
    note: '像切换面板，不那么像刷新。',
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -18 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 4,
    name: 'Vertical Sheet',
    note: '像下方内容重新落位。',
    initial: { opacity: 0, y: 18, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.995 },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 5,
    name: 'Depth Crossfade',
    note: '加一点景深感，更柔。',
    initial: { opacity: 0, scale: 0.985, filter: 'blur(8px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 1.01, filter: 'blur(6px)' },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 6,
    name: 'Panel Swap',
    note: '位移更明确，存在感更强。',
    initial: { opacity: 0, x: 34, scale: 0.992 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -28, scale: 0.992 },
    transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 7,
    name: 'Compressed Lift',
    note: '先轻压，再展开，质感更强。',
    initial: { opacity: 0, y: 14, scaleY: 0.97, transformOrigin: 'top center' },
    animate: { opacity: 1, y: 0, scaleY: 1, transformOrigin: 'top center' },
    exit: { opacity: 0, y: 4, scaleY: 0.985, transformOrigin: 'top center' },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 8,
    name: 'Card Dissolve',
    note: '更像卡片自己换内容，不像整块重渲。',
    initial: { opacity: 0, scale: 0.992 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.992 },
    transition: { duration: 0.18, ease: 'easeOut' },
    wrapperClassName: 'origin-top',
  },
  {
    id: 9,
    name: 'Delayed Content',
    note: '先壳体稳定，再让内容跟上。',
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
    transition: { duration: 0.2, delay: 0.03, ease: [0.22, 1, 0.36, 1] },
  },
  {
    id: 10,
    name: 'Production Pick',
    note: '我会优先推荐这个，柔和但不拖泥带水。',
    initial: { opacity: 0, y: 8, scale: 0.996 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 4, scale: 0.998 },
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
];

function MockDetail({ channel }: { channel: Channel }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Channel Label</div>
          <div className="mt-2 text-[14px] font-semibold text-zinc-950">{channel.name}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Models</div>
          <div className="mt-2 text-[14px] font-semibold text-zinc-950">{channel.models}</div>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200/80 bg-white px-5 py-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Base URL</div>
        <div className="mt-2 font-mono text-[13px] text-zinc-600">{channel.host}</div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">Latency</div>
            <div className="mt-2 text-[15px] font-semibold text-zinc-900">
              {channel.id === 'openrouter' ? '168ms' : channel.id === 'azure' ? '112ms' : '184ms'}
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">Health</div>
            <div className="mt-2 text-[15px] font-semibold text-zinc-900">Ready</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">Status</div>
            <div className="mt-2 text-[15px] font-semibold text-zinc-900">Enabled</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransitionPreview({ variant }: { variant: VariantConfig }) {
  const [selectedId, setSelectedId] = useState(CHANNELS[0].id);
  const selectedChannel = useMemo(
    () => CHANNELS.find((channel) => channel.id === selectedId) ?? CHANNELS[0],
    [selectedId],
  );

  return (
    <div className="rounded-[28px] border border-zinc-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-3">
          {CHANNELS.map((channel) => {
            const active = channel.id === selectedId;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => setSelectedId(channel.id)}
                className={cn(
                  'w-full rounded-[20px] border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-zinc-200/80 bg-white hover:border-zinc-300',
                )}
              >
                <div className="truncate text-[14px] font-semibold text-zinc-950">{channel.name}</div>
                <div className="mt-1 truncate text-[12px] text-zinc-500">{channel.host}</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{channel.models} models</span>
                  <span className="inline-flex h-5 items-center rounded-full bg-zinc-100 px-2 text-[10px] text-zinc-600">
                    Open
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-h-[296px] rounded-[28px] border border-zinc-200/80 bg-zinc-50/60 p-3">
          <AnimatePresence initial={false} mode={variant.mode ?? 'wait'}>
            <motion.div
              key={selectedChannel.id}
              initial={variant.initial}
              animate={variant.animate}
              exit={variant.exit}
              transition={variant.transition}
              className={cn('h-full rounded-[22px]', variant.wrapperClassName)}
            >
              <MockDetail channel={selectedChannel} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function ChannelTransitionLab() {
  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-8 pb-24">
      <div className="rounded-[32px] border border-zinc-200/80 bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_38%,#f3f4f6_100%)] px-8 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Motion Lab</div>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-zinc-950">
          Channel detail switch transitions
        </h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-zinc-500">
          这 10 个方案只看“点击左侧渠道卡后，下面详情区怎么切换”。结构都尽量贴近你当前的设置页，不去搞花哨视觉，
          重点看它是像刷新、像切页、还是像卡片内部换内容。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {VARIANTS.map((variant) => (
          <section key={variant.id} className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
            <div className="mb-5 border-b border-zinc-100 pb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Option {variant.id}</div>
              <h2 className="mt-1 text-[18px] font-semibold text-zinc-950">{variant.name}</h2>
              <p className="mt-2 text-[13px] leading-5 text-zinc-500">{variant.note}</p>
            </div>

            <TransitionPreview variant={variant} />
          </section>
        ))}
      </div>
    </div>
  );
}
