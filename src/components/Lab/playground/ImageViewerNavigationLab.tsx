import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type LayoutId = 'edgeFloat' | 'sideCapsule' | 'verticalRail' | 'captionPod' | 'bottomOrbit' | 'peekTab';
type MaterialId = 'air' | 'porcelain' | 'frost' | 'linen' | 'silver';

type LayoutDefinition = {
  id: LayoutId;
  name: string;
};

type MaterialDefinition = {
  id: MaterialId;
  name: string;
  frameClassName: string;
  overlayClassName: string;
  panelClassName: string;
  buttonClassName: string;
  buttonHoverClassName: string;
  iconClassName: string;
  metaClassName: string;
  labelClassName: string;
  borderClassName: string;
};

const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'edgeFloat',
    name: 'Edge Float',
  },
  {
    id: 'sideCapsule',
    name: 'Side Capsule',
  },
  {
    id: 'verticalRail',
    name: 'Vertical Rail',
  },
  {
    id: 'captionPod',
    name: 'Caption Pod',
  },
  {
    id: 'bottomOrbit',
    name: 'Bottom Orbit',
  },
  {
    id: 'peekTab',
    name: 'Peek Tab',
  },
];

const MATERIALS: MaterialDefinition[] = [
  {
    id: 'air',
    name: 'Air',
    frameClassName: 'border border-sky-100 bg-[linear-gradient(180deg,#f7fbff_0%,#eaf3fb_100%)]',
    overlayClassName: 'bg-white/24',
    panelClassName: 'border border-white/75 bg-white/66 backdrop-blur-2xl shadow-[0_18px_54px_rgba(84,121,160,0.16)]',
    buttonClassName: 'bg-white/78 border border-white/80',
    buttonHoverClassName: 'hover:bg-white',
    iconClassName: 'text-slate-700',
    metaClassName: 'text-slate-500',
    labelClassName: 'text-slate-800',
    borderClassName: 'border-white/70',
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    frameClassName: 'border border-stone-200 bg-[linear-gradient(180deg,#fbf8f3_0%,#eee7de_100%)]',
    overlayClassName: 'bg-white/22',
    panelClassName: 'border border-stone-200/75 bg-[#fffdfa]/88 backdrop-blur-xl shadow-[0_18px_48px_rgba(91,72,47,0.14)]',
    buttonClassName: 'bg-[#fbf8f2] border border-stone-200',
    buttonHoverClassName: 'hover:bg-[#f4ede4]',
    iconClassName: 'text-stone-700',
    metaClassName: 'text-stone-500',
    labelClassName: 'text-stone-800',
    borderClassName: 'border-stone-200',
  },
  {
    id: 'frost',
    name: 'Frost',
    frameClassName: 'border border-blue-100 bg-[linear-gradient(180deg,#f9fcff_0%,#edf4f8_100%)]',
    overlayClassName: 'bg-white/18',
    panelClassName: 'border border-white/75 bg-white/58 backdrop-blur-3xl shadow-[0_24px_64px_rgba(114,145,172,0.16)]',
    buttonClassName: 'bg-white/70 border border-white/75',
    buttonHoverClassName: 'hover:bg-white/82',
    iconClassName: 'text-slate-700',
    metaClassName: 'text-slate-500',
    labelClassName: 'text-slate-800',
    borderClassName: 'border-white/70',
  },
  {
    id: 'linen',
    name: 'Linen',
    frameClassName: 'border border-zinc-200 bg-[linear-gradient(180deg,#fbfbfa_0%,#f0f0ed_100%)]',
    overlayClassName: 'bg-white/20',
    panelClassName: 'border border-zinc-200 bg-[#fcfcfb]/92 shadow-[0_14px_40px_rgba(39,39,42,0.10)]',
    buttonClassName: 'bg-white border border-zinc-200',
    buttonHoverClassName: 'hover:bg-zinc-100',
    iconClassName: 'text-zinc-700',
    metaClassName: 'text-zinc-500',
    labelClassName: 'text-zinc-800',
    borderClassName: 'border-zinc-200',
  },
  {
    id: 'silver',
    name: 'Silver',
    frameClassName: 'border border-slate-200 bg-[linear-gradient(180deg,#f5f8fb_0%,#e6ebf1_100%)]',
    overlayClassName: 'bg-white/20',
    panelClassName: 'border border-slate-200/90 bg-[#f7f9fc]/88 backdrop-blur-xl shadow-[0_18px_48px_rgba(71,85,105,0.14)]',
    buttonClassName: 'bg-white border border-slate-200',
    buttonHoverClassName: 'hover:bg-slate-100',
    iconClassName: 'text-slate-700',
    metaClassName: 'text-slate-500',
    labelClassName: 'text-slate-800',
    borderClassName: 'border-slate-200',
  },
];

const VARIANTS = LAYOUTS.flatMap((layout, layoutIndex) =>
  MATERIALS.map((material, materialIndex) => ({
    id: layoutIndex * MATERIALS.length + materialIndex + 1,
    layout,
    material,
  }))
);

const SELECTED_VARIANT_IDS = new Set([15, 1]);

const SELECTED_VARIANTS = VARIANTS.filter((variant) => SELECTED_VARIANT_IDS.has(variant.id));

function Canvas({ material, children }: { material: MaterialDefinition; children: ReactNode }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[28px] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]', material.frameClassName)}>
      <div className="relative h-[300px] overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.92),transparent_26%),linear-gradient(135deg,#c3d8e9_0%,#d9c5b1_40%,#b3c2c6_100%)]">
        <div className={cn('absolute inset-0', material.overlayClassName)} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.08)_100%)]" />
        <div className="absolute left-1/2 top-1/2 h-[180px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,255,255,0.18))] shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-[2px]" />
        <div className="absolute right-5 top-5 rounded-full border border-white/50 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-600 backdrop-blur-sm">
          3 / 12
        </div>
        {children}
      </div>
    </div>
  );
}

function NavCircle({
  direction,
  material,
  className,
}: {
  direction: 'left' | 'right';
  material: MaterialDefinition;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        material.buttonClassName,
        material.buttonHoverClassName,
        className
      )}
    >
      <Icon
        name={direction === 'left' ? 'nav.chevronLeft' : 'nav.chevronRight'}
        size="md"
        className={material.iconClassName}
      />
    </button>
  );
}

function SideChip({
  direction,
  material,
}: {
  direction: 'left' | 'right';
  material: MaterialDefinition;
}) {
  const label = direction === 'left' ? 'Previous' : 'Next';
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-2 transition-colors',
        material.panelClassName,
        material.buttonHoverClassName
      )}
    >
      {direction === 'left' && <Icon name="nav.chevronLeft" size="md" className={material.iconClassName} />}
      <span className={cn('text-[12px] font-medium', material.labelClassName)}>{label}</span>
      {direction === 'right' && <Icon name="nav.chevronRight" size="md" className={material.iconClassName} />}
    </button>
  );
}

function RailButton({
  direction,
  material,
}: {
  direction: 'left' | 'right';
  material: MaterialDefinition;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-[72px] w-11 items-center justify-center rounded-full transition-colors',
        material.panelClassName,
        material.buttonHoverClassName
      )}
    >
      <Icon
        name={direction === 'left' ? 'nav.chevronLeft' : 'nav.chevronRight'}
        size="lg"
        className={material.iconClassName}
      />
    </button>
  );
}

function CaptionPod({
  direction,
  material,
}: {
  direction: 'left' | 'right';
  material: MaterialDefinition;
}) {
  const isLeft = direction === 'left';
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-2 rounded-[18px] px-3 py-2 transition-colors',
        material.panelClassName,
        material.buttonHoverClassName
      )}
    >
      {isLeft && <Icon name="nav.chevronLeft" size="md" className={material.iconClassName} />}
      <div className={cn('text-left text-[11px] leading-4', material.metaClassName)}>
        <div className={cn('font-semibold', material.labelClassName)}>{isLeft ? 'Prev' : 'Next'}</div>
        <div>{isLeft ? 'Image 2' : 'Image 4'}</div>
      </div>
      {!isLeft && <Icon name="nav.chevronRight" size="md" className={material.iconClassName} />}
    </button>
  );
}

function PeekTab({
  direction,
  material,
}: {
  direction: 'left' | 'right';
  material: MaterialDefinition;
}) {
  const rounded = direction === 'left' ? 'rounded-r-[20px]' : 'rounded-l-[20px]';
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-[72px] w-[54px] items-center justify-center border transition-colors',
        rounded,
        material.buttonClassName,
        material.borderClassName,
        material.buttonHoverClassName
      )}
    >
      <Icon
        name={direction === 'left' ? 'nav.chevronLeft' : 'nav.chevronRight'}
        size="lg"
        className={material.iconClassName}
      />
    </button>
  );
}

function CenterIndex({ material }: { material: MaterialDefinition }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2', material.panelClassName)}>
      <span className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', material.metaClassName)}>Image</span>
      <div className={cn('h-4 w-px', material.borderClassName)} />
      <span className={cn('text-[12px] font-semibold tabular-nums', material.labelClassName)}>3 / 12</span>
    </div>
  );
}

function PreviewLayout({
  layout,
  material,
}: {
  layout: LayoutDefinition;
  material: MaterialDefinition;
}) {
  if (layout.id === 'edgeFloat') {
    return (
      <>
        <div className="absolute inset-y-0 left-4 flex items-center">
          <NavCircle direction="left" material={material} />
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <NavCircle direction="right" material={material} />
        </div>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <CenterIndex material={material} />
        </div>
      </>
    );
  }

  if (layout.id === 'sideCapsule') {
    return (
      <>
        <div className="absolute inset-y-0 left-4 flex items-center">
          <SideChip direction="left" material={material} />
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <SideChip direction="right" material={material} />
        </div>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <CenterIndex material={material} />
        </div>
      </>
    );
  }

  if (layout.id === 'verticalRail') {
    return (
      <>
        <div className="absolute inset-y-0 left-4 flex items-center">
          <RailButton direction="left" material={material} />
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <RailButton direction="right" material={material} />
        </div>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <CenterIndex material={material} />
        </div>
      </>
    );
  }

  if (layout.id === 'captionPod') {
    return (
      <>
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <CaptionPod direction="left" material={material} />
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <CaptionPod direction="right" material={material} />
        </div>
      </>
    );
  }

  if (layout.id === 'bottomOrbit') {
    return (
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 px-4">
        <SideChip direction="left" material={material} />
        <CenterIndex material={material} />
        <SideChip direction="right" material={material} />
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-y-0 left-0 flex items-center">
        <PeekTab direction="left" material={material} />
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center">
        <PeekTab direction="right" material={material} />
      </div>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <CenterIndex material={material} />
      </div>
    </>
  );
}

function VariantCard({
  index,
  layout,
  material,
}: {
  index: number;
  layout: LayoutDefinition;
  material: MaterialDefinition;
}) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Option {index}
          </div>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-neutral-900">
            {layout.name} / {material.name}
          </h3>
        </div>
        <div className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Browse
        </div>
      </div>

      <div className="mt-5">
        <Canvas material={material}>
          <PreviewLayout layout={layout} material={material} />
        </Canvas>
      </div>
    </section>
  );
}

export function ImageViewerNavigationLab() {
  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-8 pb-24">
      <div className="max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Image Viewer Navigation Lab
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          Selected directions: 15 and 1
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          Only the two shortlisted directions remain here so you can compare them directly without the rest of the
          exploration getting in the way.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {SELECTED_VARIANTS.map((variant) => (
          <VariantCard
            key={variant.id}
            index={variant.id}
            layout={variant.layout}
            material={variant.material}
          />
        ))}
      </div>
    </div>
  );
}
