import { Icon } from '@/components/ui/icons';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { getModuleShortcutPreset } from '@/lib/shortcuts/moduleShortcuts';
import { cn } from '@/lib/utils';

type LayoutId =
  | 'settingsSheet'
  | 'titleBar'
  | 'sectionCards'
  | 'ledger'
  | 'insetHero'
  | 'utilityRail';

type SkinId = 'soft' | 'paper' | 'mist' | 'frame' | 'panel';

type LayoutDefinition = {
  id: LayoutId;
  name: string;
};

type SkinDefinition = {
  id: SkinId;
  name: string;
  canvasClassName: string;
  shellClassName: string;
  headerClassName: string;
  sectionClassName: string;
  rowClassName: string;
  dividerClassName: string;
  titleClassName: string;
  bodyClassName: string;
  mutedClassName: string;
  overlineClassName: string;
  badgeClassName: string;
  keyClassName: string;
  closeClassName: string;
};

const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'settingsSheet',
    name: 'Settings Sheet',
  },
  {
    id: 'titleBar',
    name: 'Title Bar',
  },
  {
    id: 'sectionCards',
    name: 'Section Cards',
  },
  {
    id: 'ledger',
    name: 'Ledger',
  },
  {
    id: 'insetHero',
    name: 'Inset Hero',
  },
  {
    id: 'utilityRail',
    name: 'Utility Rail',
  },
];

const SKINS: SkinDefinition[] = [
  {
    id: 'soft',
    name: 'Soft',
    canvasClassName: 'border border-zinc-200 bg-[#f5f5f4]',
    shellClassName: 'bg-white border border-black/5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]',
    headerClassName: 'bg-white',
    sectionClassName: 'bg-transparent',
    rowClassName: 'hover:bg-zinc-50',
    dividerClassName: 'border-zinc-100',
    titleClassName: 'text-zinc-900',
    bodyClassName: 'text-zinc-600',
    mutedClassName: 'text-zinc-500',
    overlineClassName: 'text-zinc-400',
    badgeClassName: 'bg-zinc-100 text-zinc-500',
    keyClassName: 'border border-zinc-200 bg-zinc-50 text-zinc-700 rounded-[8px] shadow-none',
    closeClassName: 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
  },
  {
    id: 'paper',
    name: 'Paper',
    canvasClassName: 'border border-stone-200 bg-[#f3f1ed]',
    shellClassName: 'bg-[#fcfbf9] border border-black/5 shadow-[0_18px_46px_rgba(36,31,27,0.08)]',
    headerClassName: 'bg-[#fcfbf9]',
    sectionClassName: 'bg-transparent',
    rowClassName: 'hover:bg-stone-50',
    dividerClassName: 'border-stone-100',
    titleClassName: 'text-stone-900',
    bodyClassName: 'text-stone-600',
    mutedClassName: 'text-stone-500',
    overlineClassName: 'text-stone-400',
    badgeClassName: 'bg-stone-100 text-stone-500',
    keyClassName: 'border border-stone-200 bg-white text-stone-700 rounded-[8px] shadow-none',
    closeClassName: 'text-stone-400 hover:bg-stone-100 hover:text-stone-700',
  },
  {
    id: 'mist',
    name: 'Mist',
    canvasClassName: 'border border-zinc-200 bg-[#eef0f2]',
    shellClassName: 'bg-white/78 border border-white/70 backdrop-blur-xl shadow-[0_22px_54px_rgba(15,23,42,0.10)]',
    headerClassName: 'bg-white/35',
    sectionClassName: 'bg-white/45',
    rowClassName: 'hover:bg-white/70',
    dividerClassName: 'border-black/[0.05]',
    titleClassName: 'text-zinc-900',
    bodyClassName: 'text-zinc-600',
    mutedClassName: 'text-zinc-500',
    overlineClassName: 'text-zinc-400',
    badgeClassName: 'bg-white/70 text-zinc-500',
    keyClassName: 'border border-white/70 bg-white/75 text-zinc-700 rounded-[8px] shadow-none',
    closeClassName: 'text-zinc-400 hover:bg-white/80 hover:text-zinc-700',
  },
  {
    id: 'frame',
    name: 'Frame',
    canvasClassName: 'border border-zinc-200 bg-[#f3f4f6]',
    shellClassName:
      'bg-white border border-zinc-200 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.03]',
    headerClassName: 'bg-[#fafafa]',
    sectionClassName: 'bg-[#fafafa] border border-zinc-100',
    rowClassName: 'hover:bg-white',
    dividerClassName: 'border-zinc-100',
    titleClassName: 'text-zinc-900',
    bodyClassName: 'text-zinc-600',
    mutedClassName: 'text-zinc-500',
    overlineClassName: 'text-zinc-400',
    badgeClassName: 'bg-zinc-100 text-zinc-500',
    keyClassName: 'border border-zinc-200 bg-white text-zinc-700 rounded-[8px] shadow-none',
    closeClassName: 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
  },
  {
    id: 'panel',
    name: 'Panel',
    canvasClassName: 'border border-zinc-200 bg-[#f2f2f2]',
    shellClassName: 'bg-[#fcfcfc] border border-zinc-200 shadow-[0_16px_40px_rgba(15,23,42,0.06)]',
    headerClassName: 'bg-[#f7f7f7]',
    sectionClassName: 'bg-transparent',
    rowClassName: 'hover:bg-zinc-100/70',
    dividerClassName: 'border-zinc-200',
    titleClassName: 'text-zinc-900',
    bodyClassName: 'text-zinc-700',
    mutedClassName: 'text-zinc-500',
    overlineClassName: 'text-zinc-400',
    badgeClassName: 'bg-zinc-200/70 text-zinc-500',
    keyClassName: 'border border-zinc-200 bg-zinc-100 text-zinc-700 rounded-[8px] shadow-none',
    closeClassName: 'text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700',
  },
];

const PREVIEW_SECTIONS = getModuleShortcutPreset('chat', { isMac: false }).sections
  .slice(0, 2)
  .map((section) => ({
    ...section,
    shortcuts: section.shortcuts.slice(0, section.title === 'Chat' ? 4 : 3),
  }));

const VARIANTS = LAYOUTS.flatMap((layout, layoutIndex) =>
  SKINS.map((skin, skinIndex) => ({
    id: layoutIndex * SKINS.length + skinIndex + 1,
    layout,
    skin,
  }))
);

const SELECTED_VARIANT_IDS = new Set([1, 11, 13]);

const SELECTED_VARIANTS = VARIANTS.filter((variant) => SELECTED_VARIANT_IDS.has(variant.id));

function ShortcutRows({
  skin,
  divided = false,
  compact = false,
}: {
  skin: SkinDefinition;
  divided?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {PREVIEW_SECTIONS.map((section) => (
        <section key={section.title} className={cn('rounded-[16px]', skin.sectionClassName)}>
          <div className={cn('px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em]', skin.overlineClassName)}>
            {section.title}
          </div>
          <div className={cn('space-y-1', divided && `space-y-0 border-t ${skin.dividerClassName}`)}>
            {section.shortcuts.map((shortcut) => (
              <div
                key={`${section.title}-${shortcut.action}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors',
                  compact && 'px-3 py-1.5',
                  divided && `rounded-none border-b last:border-b-0 ${skin.dividerClassName}`,
                  skin.rowClassName
                )}
              >
                <span className={cn('min-w-0 flex-1 text-[14px] font-medium', skin.bodyClassName)}>
                  {shortcut.action}
                </span>
                <ShortcutKeys
                  keys={shortcut.keys}
                  className="shrink-0"
                  keyClassName={cn('text-[10px] font-medium', skin.keyClassName)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function PreviewShell({
  layout,
  skin,
}: {
  layout: LayoutDefinition;
  skin: SkinDefinition;
}) {
  const title = (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={cn('text-[20px] font-semibold tracking-[-0.03em]', skin.titleClassName)}>
          Keyboard shortcuts
        </div>
        <div className={cn('mt-1 text-[12px] leading-5', skin.mutedClassName)}>
          Core actions for chat, kept in one quiet utility panel.
        </div>
      </div>
      <button className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors', skin.closeClassName)}>
        <Icon name="common.close" size="md" />
      </button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className={cn('rounded-[28px] p-5', skin.canvasClassName)}>
        {layout.id === 'settingsSheet' && (
          <div className={cn('mx-auto w-full max-w-[380px] rounded-[20px] p-5', skin.shellClassName)}>
            {title}
            <div className="mt-5 space-y-5">
              <ShortcutRows skin={skin} />
            </div>
          </div>
        )}

        {layout.id === 'titleBar' && (
          <div className={cn('mx-auto w-full max-w-[380px] overflow-hidden rounded-[20px]', skin.shellClassName)}>
            <div className={cn('flex items-center justify-between border-b px-4 py-3', skin.headerClassName, skin.dividerClassName)}>
              <div className={cn('text-[13px] font-semibold', skin.titleClassName)}>Keyboard shortcuts</div>
              <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', skin.badgeClassName)}>Ctrl + /</div>
            </div>
            <div className="p-4">
              <div className={cn('pb-4 text-[12px] leading-5', skin.mutedClassName)}>
                A compact utility window aligned with the settings modal.
              </div>
              <div className="space-y-4">
                <ShortcutRows skin={skin} />
              </div>
            </div>
          </div>
        )}

        {layout.id === 'sectionCards' && (
          <div className={cn('mx-auto w-full max-w-[380px] rounded-[20px] p-4', skin.shellClassName)}>
            {title}
            <div className="mt-4 space-y-3">
              <ShortcutRows skin={skin} />
            </div>
          </div>
        )}

        {layout.id === 'ledger' && (
          <div className={cn('mx-auto w-full max-w-[380px] rounded-[20px] p-4', skin.shellClassName)}>
            <div className={cn('flex items-center justify-between pb-4', skin.dividerClassName)}>
              <div>
                <div className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', skin.overlineClassName)}>
                  Chat module
                </div>
                <div className={cn('mt-1 text-[19px] font-semibold tracking-[-0.03em]', skin.titleClassName)}>
                  Keyboard shortcuts
                </div>
              </div>
              <button className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors', skin.closeClassName)}>
                <Icon name="common.close" size="md" />
              </button>
            </div>
            <div className="space-y-4">
              <ShortcutRows skin={skin} divided compact />
            </div>
          </div>
        )}

        {layout.id === 'insetHero' && (
          <div className={cn('mx-auto w-full max-w-[380px] rounded-[20px] p-4', skin.shellClassName)}>
            <div className={cn('rounded-[16px] border p-4', skin.headerClassName, skin.dividerClassName)}>
              <div className="flex items-center justify-between">
                <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', skin.badgeClassName)}>
                  Ctrl + /
                </div>
                <button className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors', skin.closeClassName)}>
                  <Icon name="common.close" size="md" />
                </button>
              </div>
              <div className={cn('mt-4 text-[22px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>
                Keyboard shortcuts
              </div>
              <div className={cn('mt-2 text-[12px] leading-5', skin.mutedClassName)}>
                A slightly stronger heading treatment, while staying within the same neutral system.
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <ShortcutRows skin={skin} compact />
            </div>
          </div>
        )}

        {layout.id === 'utilityRail' && (
          <div className={cn('mx-auto w-full max-w-[380px] rounded-[20px] p-4', skin.shellClassName)}>
            <div className="flex gap-4">
              <div className={cn('flex w-[72px] flex-col gap-2 border-r pr-3 pt-1', skin.dividerClassName)}>
                <div className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', skin.overlineClassName)}>
                  Groups
                </div>
                {PREVIEW_SECTIONS.map((section) => (
                  <div key={section.title} className={cn('rounded-lg px-2 py-1.5 text-[11px] font-medium', skin.badgeClassName)}>
                    {section.title}
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                {title}
                <div className="mt-4 space-y-4">
                  <ShortcutRows skin={skin} compact />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShortcutDialogLab() {
  return (
    <div className="mx-auto flex w-full max-w-[106rem] flex-col gap-8 pb-24">
      <div className="rounded-[28px] border border-zinc-200 bg-white px-8 py-7 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Shortcut Dialog Lab
        </div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-zinc-950">
          Selected directions: 1, 11, 13
        </h1>
        <p className="mt-3 max-w-4xl text-[14px] leading-6 text-zinc-500">
          Only the three shortlisted directions remain here, so you can compare them directly without the rest of the
          exploration getting in the way.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        {SELECTED_VARIANTS.map((variant) => (
          <section key={variant.id} className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 border-b border-zinc-100 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Option {variant.id}
                  </div>
                  <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-zinc-900">
                    {variant.layout.name} / {variant.skin.name}
                  </h2>
                </div>
                <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Neutral
                </div>
              </div>
            </div>

            <PreviewShell layout={variant.layout} skin={variant.skin} />
          </section>
        ))}
      </div>
    </div>
  );
}
