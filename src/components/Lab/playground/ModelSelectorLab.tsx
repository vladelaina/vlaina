import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type GroupOption = {
  name: string;
};

type ChannelGroup = {
  name: string;
  tag: string;
  options: GroupOption[];
};

type BadgeVariant = {
  id: number;
  name: string;
};

const GROUPS: ChannelGroup[] = [
  {
    name: 'My OpenRouter',
    tag: 'User Channel',
    options: [
      { name: 'gpt-4o' },
      { name: 'claude-3-7-sonnet' },
    ],
  },
  {
    name: 'My Azure',
    tag: 'User Channel',
    options: [
      { name: 'gpt-4o' },
      { name: 'gpt-4.1-mini' },
    ],
  },
  {
    name: 'vlaina',
    tag: 'Official',
    options: [
      { name: 'gpt-4o' },
      { name: 'claude-3-7-sonnet' },
    ],
  },
];

const BADGE_VARIANTS: BadgeVariant[] = [
  {
    id: 1,
    name: 'Deep Sage',
  },
  {
    id: 2,
    name: 'Stone Blue',
  },
  {
    id: 3,
    name: 'Warm Bronze',
  },
  {
    id: 4,
    name: 'Forest Ink',
  },
  {
    id: 5,
    name: 'Slate Navy',
  },
  {
    id: 6,
    name: 'Muted Plum',
  },
  {
    id: 7,
    name: 'Olive Smoke',
  },
  {
    id: 8,
    name: 'Graphite',
  },
  {
    id: 9,
    name: 'Dusty Teal',
  },
  {
    id: 10,
    name: 'Cocoa',
  },
  {
    id: 11,
    name: 'Petrol',
  },
  {
    id: 12,
    name: 'Ash Green',
  },
  {
    id: 13,
    name: 'Merlot',
  },
  {
    id: 14,
    name: 'Steel',
  },
  {
    id: 15,
    name: 'Moss',
  },
];

const sectionClassName = 'mx-1 rounded-xl px-1.5 py-1';
const sectionHeaderClassName =
  'flex items-center justify-between px-2 pt-2 pb-1 text-[11px] font-medium text-neutral-400';
const sectionTagClassName = 'text-[10px] text-neutral-300';
const optionClassName =
  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-neutral-100';
const optionNameClassName = 'text-sm font-medium text-neutral-700';

function SelectorPreview({ badge }: { badge: BadgeVariant }) {
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-5">
        <div className="mb-3 flex h-11 items-center justify-between rounded-full bg-transparent px-3 text-sm font-medium text-gray-700 hover:bg-black/5">
          <span>gpt-4o</span>
          <Icon name="nav.chevronDown" size="md" className="opacity-70" />
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1 border-b border-neutral-100 px-1 py-2">
            <div className="flex-1 px-2 py-0.5 text-sm text-neutral-400">Find model...</div>
            <button className="rounded-lg p-1.5 text-neutral-400">
              <Icon name="common.settings" size="md" />
            </button>
          </div>

          <div className="space-y-2 p-1.5">
            {GROUPS.map((group) => (
              <div key={`${badge.id}-${group.name}`} className={sectionClassName}>
                <div className={sectionHeaderClassName}>
                  <div className="truncate text-[11px] font-semibold text-neutral-500">{group.name}</div>
                  <div className={sectionTagClassName}>{group.tag}</div>
                </div>
                <div className="border-t border-neutral-100" />

                <div className="pt-1">
                  {group.options.map((option) => (
                    <button key={`${group.name}-${option.name}`} className={optionClassName}>
                      <div className="min-w-0">
                        <div className="flex items-center">
                          <span className={optionNameClassName}>{option.name}</span>
                        </div>
                      </div>
                      <Icon
                        name="common.check"
                        size="sm"
                        className={cn('opacity-0', option.name === 'gpt-4o' && group.name === 'My OpenRouter' && 'opacity-100 text-neutral-900')}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModelSelectorLab() {
  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-8 pb-24">
      <div className="rounded-[28px] border border-neutral-200 bg-white px-8 py-7 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Grouped Selector Lab</div>
        <h1 className="mt-2 text-[28px] font-semibold text-neutral-950">Option 30 checkmark-only preview</h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-neutral-500">
          这里保留你选中的 `Option 30` 结构，并把 `Current` 椭圆移除了。现在只保留分组标题和勾选态，
          和真实下拉保持一致。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {BADGE_VARIANTS.map((badge) => (
          <section key={badge.id} className="rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 border-b border-neutral-100 pb-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Color {badge.id}
              </div>
              <h2 className="mt-1 text-[16px] font-semibold text-neutral-900">{badge.name}</h2>
            </div>
            <SelectorPreview badge={badge} />
          </section>
        ))}
      </div>
    </div>
  );
}
