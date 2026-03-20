import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type MaterialId =
  | 'crystal'
  | 'linen'
  | 'porcelain'
  | 'halo'
  | 'silk'
  | 'opal'
  | 'aero';

type PinnedLayoutId = 'dock' | 'shelf';
type ExplorationLayoutId =
  | 'core'
  | 'segmented'
  | 'statusPod'
  | 'toolShelf'
  | 'dualBand'
  | 'offsetCluster';

type MaterialDefinition = {
  id: MaterialId;
  name: string;
  frameClassName: string;
  viewerClassName: string;
  toolbarClassName: string;
  primaryChipClassName: string;
  secondaryChipClassName: string;
  subtleChipClassName: string;
  actionClassName: string;
  labelClassName: string;
  metaClassName: string;
  iconClassName: string;
  separatorClassName: string;
};

type PinnedVariant = {
  id: number;
  layout: PinnedLayoutId;
  material: MaterialDefinition;
  name: string;
};

type ExplorationLayoutDefinition = {
  id: ExplorationLayoutId;
  name: string;
};

const MATERIALS: Record<MaterialId, MaterialDefinition> = {
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    frameClassName: 'border border-sky-100 bg-[linear-gradient(180deg,#f7fbff_0%,#ebf3fb_100%)]',
    viewerClassName: 'bg-white/36',
    toolbarClassName: 'border border-white/75 bg-white/68 backdrop-blur-2xl shadow-[0_20px_60px_rgba(84,121,160,0.18)]',
    primaryChipClassName: 'border border-white/80 bg-white/84',
    secondaryChipClassName: 'border border-white/70 bg-white/72',
    subtleChipClassName: 'bg-white/62',
    actionClassName: 'hover:bg-white',
    labelClassName: 'text-slate-800',
    metaClassName: 'text-slate-500',
    iconClassName: 'text-slate-700',
    separatorClassName: 'bg-slate-200/70',
  },
  linen: {
    id: 'linen',
    name: 'Linen',
    frameClassName: 'border border-zinc-200 bg-[linear-gradient(180deg,#fbfbfa_0%,#f0f0ed_100%)]',
    viewerClassName: 'bg-white/24',
    toolbarClassName: 'border border-zinc-200 bg-[#fcfcfb]/92 shadow-[0_14px_40px_rgba(39,39,42,0.10)]',
    primaryChipClassName: 'border border-zinc-200 bg-white',
    secondaryChipClassName: 'border border-zinc-200 bg-zinc-50',
    subtleChipClassName: 'bg-zinc-100/85',
    actionClassName: 'hover:bg-zinc-100',
    labelClassName: 'text-zinc-800',
    metaClassName: 'text-zinc-500',
    iconClassName: 'text-zinc-700',
    separatorClassName: 'bg-zinc-200',
  },
  porcelain: {
    id: 'porcelain',
    name: 'Porcelain',
    frameClassName: 'border border-stone-200 bg-[linear-gradient(180deg,#faf8f4_0%,#eee8df_100%)]',
    viewerClassName: 'bg-white/28',
    toolbarClassName: 'border border-stone-200/75 bg-[#fffdfa]/86 backdrop-blur-xl shadow-[0_18px_48px_rgba(91,72,47,0.14)]',
    primaryChipClassName: 'border border-stone-200 bg-[#fbf8f2]',
    secondaryChipClassName: 'border border-stone-200 bg-white',
    subtleChipClassName: 'bg-[#f6f1e9]',
    actionClassName: 'hover:bg-[#f4ede4]',
    labelClassName: 'text-stone-800',
    metaClassName: 'text-stone-500',
    iconClassName: 'text-stone-700',
    separatorClassName: 'bg-stone-200',
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    frameClassName: 'border border-blue-100 bg-[linear-gradient(180deg,#f9fcff_0%,#edf4f8_100%)]',
    viewerClassName: 'bg-white/18',
    toolbarClassName: 'border border-white/75 bg-white/58 backdrop-blur-3xl shadow-[0_24px_64px_rgba(114,145,172,0.16)]',
    primaryChipClassName: 'border border-white/75 bg-white/72',
    secondaryChipClassName: 'border border-white/70 bg-white/62',
    subtleChipClassName: 'bg-white/56',
    actionClassName: 'hover:bg-white/80',
    labelClassName: 'text-sky-950/90',
    metaClassName: 'text-slate-500',
    iconClassName: 'text-slate-700',
    separatorClassName: 'bg-slate-200/65',
  },
  silk: {
    id: 'silk',
    name: 'Silk',
    frameClassName: 'border border-slate-200 bg-[linear-gradient(180deg,#f5f8fb_0%,#e6ebf1_100%)]',
    viewerClassName: 'bg-white/22',
    toolbarClassName: 'border border-slate-200/90 bg-[#f7f9fc]/88 backdrop-blur-xl shadow-[0_18px_48px_rgba(71,85,105,0.14)]',
    primaryChipClassName: 'border border-slate-200 bg-white',
    secondaryChipClassName: 'border border-slate-200 bg-slate-50',
    subtleChipClassName: 'bg-slate-100/85',
    actionClassName: 'hover:bg-slate-100',
    labelClassName: 'text-slate-800',
    metaClassName: 'text-slate-500',
    iconClassName: 'text-slate-700',
    separatorClassName: 'bg-slate-200',
  },
  opal: {
    id: 'opal',
    name: 'Opal',
    frameClassName: 'border border-zinc-200 bg-[linear-gradient(180deg,#fcfcfd_0%,#eef2f6_100%)]',
    viewerClassName: 'bg-white/22',
    toolbarClassName: 'border border-white/70 bg-white/66 backdrop-blur-2xl shadow-[0_20px_52px_rgba(94,109,132,0.14)]',
    primaryChipClassName: 'border border-white/75 bg-white/78',
    secondaryChipClassName: 'border border-white/65 bg-white/62',
    subtleChipClassName: 'bg-white/52',
    actionClassName: 'hover:bg-white/82',
    labelClassName: 'text-slate-800',
    metaClassName: 'text-slate-500',
    iconClassName: 'text-slate-700',
    separatorClassName: 'bg-slate-200/60',
  },
  aero: {
    id: 'aero',
    name: 'Aero',
    frameClassName: 'border border-zinc-200 bg-[linear-gradient(180deg,#f7f7f8_0%,#eceef1_100%)]',
    viewerClassName: 'bg-white/20',
    toolbarClassName: 'border border-zinc-200 bg-[#f9fafb]/92 shadow-[0_16px_44px_rgba(31,41,55,0.10)]',
    primaryChipClassName: 'border border-zinc-200 bg-white',
    secondaryChipClassName: 'border border-zinc-200 bg-zinc-50',
    subtleChipClassName: 'bg-zinc-100',
    actionClassName: 'hover:bg-zinc-100',
    labelClassName: 'text-zinc-800',
    metaClassName: 'text-zinc-500',
    iconClassName: 'text-zinc-700',
    separatorClassName: 'bg-zinc-200',
  },
};

const PINNED_VARIANTS: PinnedVariant[] = [
  {
    id: 16,
    layout: 'shelf',
    material: MATERIALS.crystal,
    name: 'Precision Shelf / Crystal',
  },
  {
    id: 1,
    layout: 'dock',
    material: MATERIALS.crystal,
    name: 'Floating Dock / Crystal',
  },
  {
    id: 3,
    layout: 'dock',
    material: MATERIALS.linen,
    name: 'Floating Dock / Linen',
  },
];

const EXPLORATION_LAYOUTS: ExplorationLayoutDefinition[] = [
  {
    id: 'core',
    name: 'Center Core',
  },
  {
    id: 'segmented',
    name: 'Segmented Shelf',
  },
  {
    id: 'statusPod',
    name: 'Status Pod',
  },
  {
    id: 'toolShelf',
    name: 'Tool Shelf',
  },
  {
    id: 'dualBand',
    name: 'Dual Band',
  },
  {
    id: 'offsetCluster',
    name: 'Offset Cluster',
  },
];

const EXPLORATION_MATERIALS = [
  MATERIALS.porcelain,
  MATERIALS.halo,
  MATERIALS.silk,
  MATERIALS.opal,
  MATERIALS.aero,
] as const;

const EXPLORATION_VARIANTS = EXPLORATION_LAYOUTS.flatMap((layout, layoutIndex) =>
  EXPLORATION_MATERIALS.map((material, materialIndex) => ({
    id: layoutIndex * EXPLORATION_MATERIALS.length + materialIndex + 1,
    layout,
    material,
  }))
);

function ViewerBackdrop({ material }: { material: MaterialDefinition }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
        material.frameClassName
      )}
    >
      <div className="relative h-[280px] overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_28%),linear-gradient(135deg,#c2d7e8_0%,#d3bfaa_38%,#aebfc3_100%)]">
        <div className={cn('absolute inset-0', material.viewerClassName)} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.06)_100%)]" />
        <div className="absolute left-1/2 top-1/2 h-[170px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,255,255,0.18))] shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-[2px]" />
      </div>
    </div>
  );
}

function ActionButton({
  name,
  material,
  className,
}: {
  name: 'common.remove' | 'common.add' | 'common.copy' | 'common.download';
  material: MaterialDefinition;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
        material.subtleChipClassName,
        material.actionClassName,
        className
      )}
    >
      <Icon name={name} size="md" className={material.iconClassName} />
    </button>
  );
}

function ZoomChip({ material }: { material: MaterialDefinition }) {
  return (
    <div className={cn('inline-flex min-w-[62px] items-center justify-center rounded-full px-3 py-2', material.primaryChipClassName)}>
      <span className={cn('text-[12px] font-semibold tabular-nums', material.labelClassName)}>128%</span>
    </div>
  );
}

function SizeChip({ material }: { material: MaterialDefinition }) {
  return (
    <div className={cn('inline-flex items-center justify-center rounded-full px-3 py-2', material.secondaryChipClassName)}>
      <span className={cn('text-[11px] font-medium tabular-nums', material.metaClassName)}>1792×1024</span>
    </div>
  );
}

function TinyLabel({ text, material }: { text: string; material: MaterialDefinition }) {
  return (
    <div className={cn('rounded-full px-2.5 py-1', material.secondaryChipClassName)}>
      <span className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', material.metaClassName)}>{text}</span>
    </div>
  );
}

function PinnedPreview({
  layout,
  material,
}: {
  layout: PinnedLayoutId;
  material: MaterialDefinition;
}) {
  const baseClassName = cn('absolute inset-x-0 bottom-4 flex justify-center px-4', material.labelClassName);

  if (layout === 'dock') {
    return (
      <div className={baseClassName}>
        <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-2', material.toolbarClassName)}>
          <ActionButton name="common.remove" material={material} />
          <ZoomChip material={material} />
          <ActionButton name="common.add" material={material} />
          <div className={cn('mx-1 h-6 w-px', material.separatorClassName)} />
          <SizeChip material={material} />
          <div className={cn('mx-1 h-6 w-px', material.separatorClassName)} />
          <ActionButton name="common.copy" material={material} />
          <ActionButton name="common.download" material={material} />
        </div>
      </div>
    );
  }

  return (
    <div className={baseClassName}>
      <div className={cn('inline-flex items-center rounded-[22px] px-2 py-2', material.toolbarClassName)}>
        <ActionButton name="common.remove" material={material} />
        <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
        <ZoomChip material={material} />
        <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
        <ActionButton name="common.add" material={material} />
        <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
        <SizeChip material={material} />
        <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
        <ActionButton name="common.copy" material={material} />
        <ActionButton name="common.download" material={material} />
      </div>
    </div>
  );
}

function ExplorationPreview({
  layout,
  material,
}: {
  layout: ExplorationLayoutDefinition;
  material: MaterialDefinition;
}) {
  const baseClassName = cn('absolute inset-x-0 bottom-4 flex justify-center px-4', material.labelClassName);

  if (layout.id === 'core') {
    return (
      <div className={baseClassName}>
        <div className={cn('inline-flex items-center gap-2 rounded-full px-2 py-2', material.toolbarClassName)}>
          <ActionButton name="common.remove" material={material} />
          <div className={cn('inline-flex items-center gap-2 rounded-full px-2 py-1.5', material.primaryChipClassName)}>
            <ZoomChip material={material} />
            <div className={cn('h-5 w-px', material.separatorClassName)} />
            <SizeChip material={material} />
          </div>
          <ActionButton name="common.add" material={material} />
          <div className={cn('mx-1 h-6 w-px', material.separatorClassName)} />
          <ActionButton name="common.copy" material={material} />
          <ActionButton name="common.download" material={material} />
        </div>
      </div>
    );
  }

  if (layout.id === 'segmented') {
    return (
      <div className={baseClassName}>
        <div className={cn('inline-flex items-center gap-2 rounded-[24px] px-2 py-2', material.toolbarClassName)}>
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1.5', material.secondaryChipClassName)}>
            <ActionButton name="common.remove" material={material} />
            <ZoomChip material={material} />
            <ActionButton name="common.add" material={material} />
          </div>
          <div className={cn('inline-flex items-center rounded-full px-2 py-1.5', material.secondaryChipClassName)}>
            <SizeChip material={material} />
          </div>
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1.5', material.secondaryChipClassName)}>
            <ActionButton name="common.copy" material={material} />
            <ActionButton name="common.download" material={material} />
          </div>
        </div>
      </div>
    );
  }

  if (layout.id === 'statusPod') {
    return (
      <div className={baseClassName}>
        <div className="flex items-center gap-3">
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-2', material.toolbarClassName)}>
            <ActionButton name="common.remove" material={material} />
            <ActionButton name="common.add" material={material} />
          </div>
          <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2', material.toolbarClassName)}>
            <TinyLabel text="zoom" material={material} />
            <ZoomChip material={material} />
            <div className={cn('h-6 w-px', material.separatorClassName)} />
            <TinyLabel text="size" material={material} />
            <SizeChip material={material} />
          </div>
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-2', material.toolbarClassName)}>
            <ActionButton name="common.copy" material={material} />
            <ActionButton name="common.download" material={material} />
          </div>
        </div>
      </div>
    );
  }

  if (layout.id === 'toolShelf') {
    return (
      <div className={baseClassName}>
        <div className={cn('inline-flex items-center rounded-[22px] px-2 py-2', material.toolbarClassName)}>
          <TinyLabel text="viewer" material={material} />
          <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
          <ActionButton name="common.remove" material={material} />
          <ZoomChip material={material} />
          <ActionButton name="common.add" material={material} />
          <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
          <SizeChip material={material} />
          <div className={cn('mx-2 h-7 w-px', material.separatorClassName)} />
          <ActionButton name="common.copy" material={material} />
          <ActionButton name="common.download" material={material} />
        </div>
      </div>
    );
  }

  if (layout.id === 'dualBand') {
    return (
      <div className={baseClassName}>
        <div className={cn('inline-flex flex-col gap-2 rounded-[24px] px-3 py-3', material.toolbarClassName)}>
          <div className="flex items-center justify-center gap-2">
            <TinyLabel text="preview" material={material} />
            <ZoomChip material={material} />
            <SizeChip material={material} />
          </div>
          <div className="flex items-center justify-center gap-1">
            <ActionButton name="common.remove" material={material} />
            <ActionButton name="common.add" material={material} />
            <div className={cn('mx-1 h-6 w-px', material.separatorClassName)} />
            <ActionButton name="common.copy" material={material} />
            <ActionButton name="common.download" material={material} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={baseClassName}>
      <div className="flex items-end gap-3">
        <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-2', material.toolbarClassName)}>
          <ActionButton name="common.remove" material={material} />
          <ActionButton name="common.add" material={material} />
        </div>
        <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2', material.toolbarClassName)}>
          <ZoomChip material={material} />
          <div className={cn('h-6 w-px', material.separatorClassName)} />
          <SizeChip material={material} />
        </div>
        <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-2', material.toolbarClassName)}>
          <ActionButton name="common.copy" material={material} />
          <ActionButton name="common.download" material={material} />
        </div>
      </div>
    </div>
  );
}

function VariantCard({
  eyebrow,
  title,
  badge,
  preview,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  preview: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{eyebrow}</div>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-neutral-900">{title}</h3>
        </div>
        <div className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {badge}
        </div>
      </div>

      <div className="mt-5">
        {preview}
      </div>
    </section>
  );
}

function PreviewCanvas({
  material,
  children,
}: {
  material: MaterialDefinition;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <ViewerBackdrop material={material} />
      <div className="-mt-[292px] relative h-[280px]">{children}</div>
    </div>
  );
}

export function ImageViewerControlsLab() {
  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-8 pb-24">
      <div className="max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Image Viewer Controls Lab
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          3 pinned foundations, then 30 new directions built on top of them
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          The three pinned options stay at the top as the current best foundations. The 30 new explorations below push
          those foundations forward by rethinking grouping, status priority, symmetry, and calmness from first
          principles.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Pinned</div>
            <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-neutral-950">
              Keep these three at the top
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {PINNED_VARIANTS.map((variant) => (
            <VariantCard
              key={`pinned-${variant.id}`}
              eyebrow={`Pinned ${variant.id}`}
              title={variant.name}
              badge="Keep"
              preview={
                <PreviewCanvas material={variant.material}>
                  <PinnedPreview layout={variant.layout} material={variant.material} />
                </PreviewCanvas>
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Round Two</div>
          <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-neutral-950">
            30 refined directions
          </div>
          <p className="mt-2 max-w-4xl text-[14px] leading-6 text-neutral-500">
            These are not just recolors of the same toolbar. They are new compositional ideas derived from the three
            pinned candidates: stronger center focus, cleaner segmentation, calmer tool grouping, and brighter material
            choices.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {EXPLORATION_VARIANTS.map((variant) => (
            <VariantCard
              key={`exploration-${variant.id}`}
              eyebrow={`New ${variant.id}`}
              title={`${variant.layout.name} / ${variant.material.name}`}
              badge="Explore"
              preview={
                <PreviewCanvas material={variant.material}>
                  <ExplorationPreview layout={variant.layout} material={variant.material} />
                </PreviewCanvas>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
