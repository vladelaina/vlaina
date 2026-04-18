import { cn } from '@/lib/utils';

type LayoutId =
  | 'titleDock'
  | 'marginTab'
  | 'splitConsole'
  | 'formulaRibbon'
  | 'cornerStamp'
  | 'ledgerStack'
  | 'floatingSheet'
  | 'utilityStrip'
  | 'archiveCard'
  | 'monoPanel';

type SkinId = 'quartz' | 'graphite' | 'citrus' | 'harbor' | 'studio';

interface LayoutDefinition {
  id: LayoutId;
  name: string;
  note: string;
}

interface SkinDefinition {
  id: SkinId;
  name: string;
  canvasClassName: string;
  glowClassName: string;
  noteClassName: string;
  noteTitleClassName: string;
  noteTextClassName: string;
  shellClassName: string;
  titleClassName: string;
  metaClassName: string;
  dividerClassName: string;
  fieldClassName: string;
  fieldTextClassName: string;
  fieldMutedClassName: string;
  badgeClassName: string;
  secondaryButtonClassName: string;
  primaryButtonClassName: string;
}

const LAYOUTS: LayoutDefinition[] = [
  { id: 'titleDock', name: 'Title Dock', note: 'Large title band with a grounded footer.' },
  { id: 'marginTab', name: 'Margin Tab', note: 'A clipped tab makes the editor feel filed into the page.' },
  { id: 'splitConsole', name: 'Split Console', note: 'A left rail carries context while the field dominates.' },
  { id: 'formulaRibbon', name: 'Formula Ribbon', note: 'A horizontal ribbon frames the equation as the hero.' },
  { id: 'cornerStamp', name: 'Corner Stamp', note: 'A stamped serial corner gives it an instrument feel.' },
  { id: 'ledgerStack', name: 'Ledger Stack', note: 'Structured rows and dividers like a technical ledger.' },
  { id: 'floatingSheet', name: 'Floating Sheet', note: 'A detached footer bar lightens the shell weight.' },
  { id: 'utilityStrip', name: 'Utility Strip', note: 'Tools are grouped into a skinny utilitarian strip.' },
  { id: 'archiveCard', name: 'Archive Card', note: 'Editorial card with status and wide primary action.' },
  { id: 'monoPanel', name: 'Mono Panel', note: 'Tighter monochrome proportions with sharp hierarchy.' },
];

const SKINS: SkinDefinition[] = [
  {
    id: 'quartz',
    name: 'Quartz',
    canvasClassName: 'border border-stone-200 bg-[radial-gradient(circle_at_top,_#fffdf8,_#f2ede4_58%,_#ebe4d8)]',
    glowClassName: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.85),_transparent_68%)]',
    noteClassName: 'border border-stone-200/80 bg-white/85',
    noteTitleClassName: 'text-stone-900',
    noteTextClassName: 'text-stone-500',
    shellClassName: 'border border-stone-200/90 bg-white/95',
    titleClassName: 'text-stone-950',
    metaClassName: 'text-stone-500',
    dividerClassName: 'border-stone-200/80',
    fieldClassName: 'border border-stone-200 bg-white',
    fieldTextClassName: 'text-stone-900',
    fieldMutedClassName: 'text-stone-400',
    badgeClassName: 'bg-stone-100 text-stone-600',
    secondaryButtonClassName: 'border border-stone-200 bg-white text-stone-700',
    primaryButtonClassName: 'bg-stone-900 text-white',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    canvasClassName: 'border border-zinc-700 bg-[radial-gradient(circle_at_top,_#35353a,_#17171b_62%,_#111114)]',
    glowClassName: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.12),_transparent_70%)]',
    noteClassName: 'border border-white/10 bg-white/[0.04]',
    noteTitleClassName: 'text-zinc-100',
    noteTextClassName: 'text-zinc-400',
    shellClassName: 'border border-white/10 bg-[#151519]',
    titleClassName: 'text-white',
    metaClassName: 'text-zinc-400',
    dividerClassName: 'border-white/10',
    fieldClassName: 'border border-white/10 bg-[#0d0d10]',
    fieldTextClassName: 'text-zinc-100',
    fieldMutedClassName: 'text-zinc-500',
    badgeClassName: 'bg-white/10 text-zinc-300',
    secondaryButtonClassName: 'border border-white/10 bg-white/[0.04] text-zinc-200',
    primaryButtonClassName: 'bg-white text-zinc-900',
  },
  {
    id: 'citrus',
    name: 'Citrus',
    canvasClassName: 'border border-amber-200 bg-[radial-gradient(circle_at_top,_#fff7d6,_#ffe7a3_54%,_#f5d77a)]',
    glowClassName: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.68),_transparent_72%)]',
    noteClassName: 'border border-amber-200/80 bg-white/80',
    noteTitleClassName: 'text-amber-950',
    noteTextClassName: 'text-amber-700/80',
    shellClassName: 'border border-amber-300/80 bg-[#fff9ea]',
    titleClassName: 'text-amber-950',
    metaClassName: 'text-amber-700/80',
    dividerClassName: 'border-amber-300/70',
    fieldClassName: 'border border-amber-200 bg-white',
    fieldTextClassName: 'text-amber-950',
    fieldMutedClassName: 'text-amber-400',
    badgeClassName: 'bg-amber-200/70 text-amber-900',
    secondaryButtonClassName: 'border border-amber-300 bg-white text-amber-900',
    primaryButtonClassName: 'bg-amber-900 text-amber-50',
  },
  {
    id: 'harbor',
    name: 'Harbor',
    canvasClassName: 'border border-sky-200 bg-[radial-gradient(circle_at_top,_#f2fbff,_#d6eef9_58%,_#bddff3)]',
    glowClassName: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.72),_transparent_72%)]',
    noteClassName: 'border border-sky-200/70 bg-white/78',
    noteTitleClassName: 'text-slate-950',
    noteTextClassName: 'text-slate-500',
    shellClassName: 'border border-sky-200/80 bg-[#fafdff]',
    titleClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    dividerClassName: 'border-sky-200/80',
    fieldClassName: 'border border-sky-200 bg-white',
    fieldTextClassName: 'text-slate-900',
    fieldMutedClassName: 'text-slate-400',
    badgeClassName: 'bg-sky-100 text-sky-800',
    secondaryButtonClassName: 'border border-sky-200 bg-white text-slate-700',
    primaryButtonClassName: 'bg-slate-900 text-white',
  },
  {
    id: 'studio',
    name: 'Studio',
    canvasClassName: 'border border-rose-200 bg-[radial-gradient(circle_at_top,_#fff6f3,_#f8e0d8_56%,_#f2c8c1)]',
    glowClassName: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.7),_transparent_72%)]',
    noteClassName: 'border border-rose-200/70 bg-white/82',
    noteTitleClassName: 'text-rose-950',
    noteTextClassName: 'text-rose-700/75',
    shellClassName: 'border border-rose-200/80 bg-[#fffaf8]',
    titleClassName: 'text-rose-950',
    metaClassName: 'text-rose-700/75',
    dividerClassName: 'border-rose-200/75',
    fieldClassName: 'border border-rose-200 bg-white',
    fieldTextClassName: 'text-rose-950',
    fieldMutedClassName: 'text-rose-400',
    badgeClassName: 'bg-rose-100 text-rose-800',
    secondaryButtonClassName: 'border border-rose-200 bg-white text-rose-900',
    primaryButtonClassName: 'bg-rose-900 text-rose-50',
  },
];

const FORMULAS = [
  '\\int_{0}^{1} x^2 dx = \\frac{1}{3}',
  'f(x) = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}',
  '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}',
  'P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}',
  '\\hat{y}=\\beta_0+\\beta_1x+\\varepsilon',
  '\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}',
];

const VARIANTS = LAYOUTS.flatMap((layout, layoutIndex) =>
  SKINS.map((skin, skinIndex) => ({
    id: layoutIndex * SKINS.length + skinIndex + 1,
    layout,
    skin,
    formula: FORMULAS[(layoutIndex + skinIndex) % FORMULAS.length],
  }))
);

function SurfaceButton({ className, children }: { className: string; children: string }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}

function FormulaField({ skin, compact = false }: { skin: SkinDefinition; compact?: boolean }) {
  return (
    <div className={cn('rounded-[12px] p-4', compact ? 'min-h-[96px]' : 'min-h-[124px]', skin.fieldClassName)}>
      <div className={cn('font-mono text-[12px] leading-6', skin.fieldTextClassName)}>
        {'\\int_{0}^{1} x^2 dx = \\frac{1}{3}'}
      </div>
      <div className={cn('mt-3 text-[11px] leading-5', skin.fieldMutedClassName)}>
        Preview lives in the note canvas, not inside the dialog.
      </div>
    </div>
  );
}

function CanvasNote({ skin, formula }: { skin: SkinDefinition; formula: string }) {
  return (
    <div className={cn('relative rounded-[22px] p-5 backdrop-blur-sm', skin.noteClassName)}>
      <div className={cn('text-[12px] font-semibold tracking-[0.14em] uppercase', skin.noteTextClassName)}>
        physics / note fragment
      </div>
      <div className={cn('mt-3 text-[20px] font-semibold tracking-[-0.04em]', skin.noteTitleClassName)}>
        Boundary Conditions
      </div>
      <div className={cn('mt-2 max-w-[32ch] text-[13px] leading-6', skin.noteTextClassName)}>
        The editor should feel lightweight, like annotating a live surface instead of opening a heavy tool panel.
      </div>
      <div className={cn('mt-5 rounded-[18px] px-4 py-3 font-mono text-[12px] leading-6', skin.shellClassName, skin.titleClassName)}>
        {`$$ ${formula} $$`}
      </div>
    </div>
  );
}

function PreviewShell({ variant }: { variant: (typeof VARIANTS)[number] }) {
  const { layout, skin, id } = variant;

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[11px] font-medium', skin.metaClassName)}>live note preview</span>
      <div className="flex items-center gap-2">
        <SurfaceButton className={skin.secondaryButtonClassName}>cancel</SurfaceButton>
        <SurfaceButton className={skin.primaryButtonClassName}>apply</SurfaceButton>
      </div>
    </div>
  );

  switch (layout.id) {
    case 'titleDock':
      return (
        <div className={cn('rounded-[24px] p-4', skin.shellClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Math editor</div>
              <div className={cn('mt-1 text-[12px]', skin.metaClassName)}>Docked title with grounded footer actions.</div>
            </div>
            <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>
              #{String(id).padStart(2, '0')}
            </div>
          </div>
          <div className={cn('my-4 border-t', skin.dividerClassName)} />
          <FormulaField skin={skin} />
          <div className={cn('mt-4 border-t pt-4', skin.dividerClassName)}>{footer}</div>
        </div>
      );
    case 'marginTab':
      return (
        <div className="relative pt-4">
          <div className={cn('absolute left-5 top-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', skin.badgeClassName)}>
            math / tab
          </div>
          <div className={cn('rounded-[24px] p-4 pt-7', skin.shellClassName)}>
            <div className={cn('text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Margin tab</div>
            <div className={cn('mt-1 text-[12px]', skin.metaClassName)}>A clipped ticket on top softens the shell.</div>
            <div className="mt-4">
              <FormulaField skin={skin} compact />
            </div>
            <div className="mt-4">{footer}</div>
          </div>
        </div>
      );
    case 'splitConsole':
      return (
        <div className={cn('grid grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-[24px]', skin.shellClassName)}>
          <div className={cn('border-r p-4', skin.dividerClassName)}>
            <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', skin.metaClassName)}>console</div>
            <div className={cn('mt-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>
              #{String(id).padStart(2, '0')}
            </div>
            <div className={cn('mt-3 text-[11px] leading-5', skin.metaClassName)}>inline edit live sync</div>
          </div>
          <div className="p-4">
            <div className={cn('text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Split console</div>
            <div className="mt-4">
              <FormulaField skin={skin} />
            </div>
            <div className="mt-4">{footer}</div>
          </div>
        </div>
      );
    case 'formulaRibbon':
      return (
        <div className={cn('rounded-[24px] p-4', skin.shellClassName)}>
          <div className={cn('rounded-[16px] px-4 py-3 font-mono text-[12px]', skin.badgeClassName)}>{'f(x)=\\sum\\limits_{n=0}^{\\infty} a_n x^n'}</div>
          <div className={cn('mt-4 text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Formula ribbon</div>
          <div className={cn('mt-1 text-[12px]', skin.metaClassName)}>The equation occupies the crown band above the field.</div>
          <div className="mt-4">
            <FormulaField skin={skin} compact />
          </div>
          <div className="mt-4">{footer}</div>
        </div>
      );
    case 'cornerStamp':
      return (
        <div className={cn('relative rounded-[24px] p-4', skin.shellClassName)}>
          <div className={cn('absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>
            #{String(id).padStart(2, '0')}
          </div>
          <div className={cn('text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Corner stamp</div>
          <div className={cn('mt-1 max-w-[30ch] text-[12px]', skin.metaClassName)}>Instrumentation feel with a serial marker pinned into the chrome.</div>
          <div className="mt-5">
            <FormulaField skin={skin} />
          </div>
          <div className={cn('mt-4 border-t pt-4', skin.dividerClassName)}>{footer}</div>
        </div>
      );
    case 'ledgerStack':
      return (
        <div className={cn('overflow-hidden rounded-[24px]', skin.shellClassName)}>
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className={cn('text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Ledger stack</div>
              <div className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', skin.metaClassName)}>rows</div>
            </div>
          </div>
          <div className={cn('border-t', skin.dividerClassName)} />
          <div className="p-4">
            <FormulaField skin={skin} compact />
          </div>
          <div className={cn('border-t px-4 py-3', skin.dividerClassName)}>{footer}</div>
        </div>
      );
    case 'floatingSheet':
      return (
        <div className="space-y-3">
          <div className={cn('rounded-[24px] p-4', skin.shellClassName)}>
            <div className={cn('text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Floating sheet</div>
            <div className={cn('mt-1 text-[12px]', skin.metaClassName)}>The sheet is lighter when the actions detach into their own bar.</div>
            <div className="mt-4">
              <FormulaField skin={skin} />
            </div>
          </div>
          <div className={cn('mx-3 rounded-full px-4 py-3', skin.shellClassName)}>{footer}</div>
        </div>
      );
    case 'utilityStrip':
      return (
        <div className={cn('rounded-[24px] p-4', skin.shellClassName)}>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>live</div>
            <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>latex</div>
            <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', skin.badgeClassName)}>#{String(id).padStart(2, '0')}</div>
          </div>
          <div className={cn('mt-4 text-[17px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Utility strip</div>
          <div className="mt-4">
            <FormulaField skin={skin} compact />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <SurfaceButton className={skin.secondaryButtonClassName}>cancel</SurfaceButton>
            <SurfaceButton className={skin.primaryButtonClassName}>apply</SurfaceButton>
          </div>
        </div>
      );
    case 'archiveCard':
      return (
        <div className={cn('rounded-[24px] p-4', skin.shellClassName)}>
          <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', skin.metaClassName)}>Equation revision #{String(id).padStart(2, '0')}</div>
          <div className={cn('mt-2 text-[18px] font-semibold tracking-[-0.04em]', skin.titleClassName)}>Archive card</div>
          <div className={cn('mt-1 max-w-[32ch] text-[12px] leading-5', skin.metaClassName)}>An editorial card with enough metadata to feel documented, not just temporary.</div>
          <div className="mt-4">
            <FormulaField skin={skin} />
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <SurfaceButton className={cn('justify-center', skin.primaryButtonClassName)}>apply to note</SurfaceButton>
            <SurfaceButton className={skin.secondaryButtonClassName}>cancel</SurfaceButton>
          </div>
        </div>
      );
    case 'monoPanel':
      return (
        <div className={cn('rounded-[18px] p-3', skin.shellClassName)}>
          <div className="flex items-center justify-between gap-3">
            <div className={cn('text-[15px] font-semibold tracking-[-0.03em]', skin.titleClassName)}>Mono panel</div>
            <div className={cn('text-[11px] font-medium', skin.metaClassName)}>#{String(id).padStart(2, '0')}</div>
          </div>
          <div className={cn('mt-3 border-t', skin.dividerClassName)} />
          <div className="mt-3">
            <FormulaField skin={skin} compact />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <SurfaceButton className={skin.secondaryButtonClassName}>dismiss</SurfaceButton>
            <SurfaceButton className={cn('flex-1', skin.primaryButtonClassName)}>commit</SurfaceButton>
          </div>
        </div>
      );
  }

  return null;
}

export function MathEditorDialogLab() {
  return (
    <div className="space-y-8">
      <div className="max-w-4xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Math Editor 50</div>
        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.06em] text-zinc-950 dark:text-zinc-100">
          Fifty dialog directions for the math editor
        </h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          Ten layout systems crossed with five surface skins. Every card is numbered so you can point at a direction fast.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {VARIANTS.map((variant) => (
          <section key={variant.id} className="rounded-[28px] border border-black/5 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  #{String(variant.id).padStart(2, '0')}
                </div>
                <div className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-100">
                  {variant.layout.name}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                  {variant.skin.name}
                </div>
              </div>
              <div className="max-w-[18rem] text-right text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                {variant.layout.note}
              </div>
            </div>

            <div className={cn('relative mt-4 overflow-hidden rounded-[24px] p-5', variant.skin.canvasClassName)}>
              <div className={cn('pointer-events-none absolute inset-0 opacity-80', variant.skin.glowClassName)} />
              <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <CanvasNote skin={variant.skin} formula={variant.formula} />
                <PreviewShell variant={variant} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
