import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

type FamilyId = 'platform' | 'developer' | 'editorial' | 'compact' | 'experimental';

type VariantTone = 'light' | 'dark' | 'warm' | 'cool' | 'neutral';

interface MathEditorVariant {
  id: number;
  name: string;
  family: FamilyId;
  tone: VariantTone;
  summary: string;
  formula: string;
  ui: {
    frame: string;
    panel: string;
    canvas: string;
    note: string;
    field: string;
    title: string;
    body: string;
    muted: string;
    line: string;
    badge: string;
    primary: string;
    secondary: string;
  };
  renderDialog: () => ReactElement;
}

const FORMULAS = [
  '\\int_{0}^{1} x^2 \\; dx = \\frac{1}{3}',
  'f(x)=\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}',
  '\\nabla \\cdot \\vec{E}=\\frac{\\rho}{\\varepsilon_0}',
  'P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}',
  '\\lim_{h \\to 0}\\frac{f(x+h)-f(x)}{h}',
  '\\hat{y}=\\beta_0+\\beta_1x+\\varepsilon',
  '\\mathbf{K}=\\mathbf{Q}\\mathbf{Q}^T+\\lambda I',
  '\\oint_C \\vec{F} \\cdot d\\vec{r}=0',
  '\\mathcal{L}(\\theta)=\\sum_i(y_i-\\hat{y}_i)^2',
  '\\psi(x,t)=Ae^{i(kx-\\omega t)}',
];

const TONES: Record<VariantTone, MathEditorVariant['ui']> = {
  light: {
    frame: 'border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f6f7f8)]',
    panel: 'border border-zinc-200 bg-white',
    canvas: 'border border-zinc-200 bg-[radial-gradient(circle_at_top,#ffffff,#eef1f4)]',
    note: 'border border-zinc-200/90 bg-white/90',
    field: 'border border-zinc-200 bg-white',
    title: 'text-zinc-950',
    body: 'text-zinc-700',
    muted: 'text-zinc-500',
    line: 'border-zinc-200',
    badge: 'bg-zinc-100 text-zinc-700',
    primary: 'bg-zinc-950 text-white',
    secondary: 'border border-zinc-200 bg-white text-zinc-700',
  },
  dark: {
    frame: 'border border-white/10 bg-[linear-gradient(180deg,#17181b,#0f1012)]',
    panel: 'border border-white/10 bg-[#131417]',
    canvas: 'border border-white/10 bg-[radial-gradient(circle_at_top,#30343a,#111214_65%)]',
    note: 'border border-white/10 bg-white/[0.04]',
    field: 'border border-white/10 bg-[#0d0e10]',
    title: 'text-white',
    body: 'text-zinc-300',
    muted: 'text-zinc-500',
    line: 'border-white/10',
    badge: 'bg-white/10 text-zinc-300',
    primary: 'bg-white text-zinc-950',
    secondary: 'border border-white/10 bg-white/[0.04] text-zinc-200',
  },
  warm: {
    frame: 'border border-amber-200 bg-[linear-gradient(180deg,#fff8ea,#f8ead1)]',
    panel: 'border border-amber-200 bg-[#fffdf7]',
    canvas: 'border border-amber-200 bg-[radial-gradient(circle_at_top,#fffdf4,#f6e6bd)]',
    note: 'border border-amber-200/80 bg-white/80',
    field: 'border border-amber-200 bg-white',
    title: 'text-amber-950',
    body: 'text-amber-900',
    muted: 'text-amber-700/80',
    line: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-900',
    primary: 'bg-amber-900 text-amber-50',
    secondary: 'border border-amber-200 bg-white text-amber-900',
  },
  cool: {
    frame: 'border border-sky-200 bg-[linear-gradient(180deg,#fbfeff,#eaf5fb)]',
    panel: 'border border-sky-200 bg-[#fcfeff]',
    canvas: 'border border-sky-200 bg-[radial-gradient(circle_at_top,#ffffff,#dceef9)]',
    note: 'border border-sky-200/80 bg-white/85',
    field: 'border border-sky-200 bg-white',
    title: 'text-slate-950',
    body: 'text-slate-700',
    muted: 'text-slate-500',
    line: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-900',
    primary: 'bg-slate-900 text-white',
    secondary: 'border border-sky-200 bg-white text-slate-700',
  },
  neutral: {
    frame: 'border border-stone-200 bg-[linear-gradient(180deg,#fbfaf8,#f0ece6)]',
    panel: 'border border-stone-200 bg-[#fcfbf8]',
    canvas: 'border border-stone-200 bg-[radial-gradient(circle_at_top,#fffefb,#ece5dc)]',
    note: 'border border-stone-200/90 bg-white/80',
    field: 'border border-stone-200 bg-white',
    title: 'text-stone-950',
    body: 'text-stone-700',
    muted: 'text-stone-500',
    line: 'border-stone-200',
    badge: 'bg-stone-100 text-stone-700',
    primary: 'bg-stone-900 text-white',
    secondary: 'border border-stone-200 bg-white text-stone-700',
  },
};

function VariantButton({ className, children, fill = false }: { className: string; children: string; fill?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase',
        fill && 'w-full',
        className
      )}
    >
      {children}
    </button>
  );
}

function DialogField({ ui, lines = 4, withAside = false }: { ui: MathEditorVariant['ui']; lines?: number; withAside?: boolean }) {
  return (
    <div className={cn('rounded-[10px] p-3', ui.field)}>
      <div className={cn('font-mono text-[12px] leading-6', ui.body)}>
        {FORMULAS[0]}
      </div>
      <div className={cn('mt-2 text-[11px] leading-5', ui.muted)}>
        {withAside ? 'Reference stays in the side rail while the note surface handles preview.' : 'Preview is delegated to the note surface outside the dialog.'}
      </div>
      {lines > 4 && <div className={cn('mt-3 border-t', ui.line)} />}
    </div>
  );
}

function CanvasPreview({ ui, formula, family }: { ui: MathEditorVariant['ui']; formula: string; family: FamilyId }) {
  return (
    <div className={cn('rounded-[24px] p-5', ui.note)}>
      <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', ui.muted)}>
        {family} / note canvas
      </div>
      <div className={cn('mt-3 text-[20px] font-semibold tracking-[-0.04em]', ui.title)}>
        Boundary Conditions
      </div>
      <div className={cn('mt-2 max-w-[32ch] text-[13px] leading-6', ui.muted)}>
        This side shows the note itself. While editing, the math block updates here instead of inside the dialog.
      </div>
      <div className={cn('mt-5 rounded-[18px] px-4 py-3 font-mono text-[12px] leading-6', ui.panel, ui.body)}>
        {`$$ ${formula} $$`}
      </div>
    </div>
  );
}

function renderPlatformTopBar(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[20px] p-4', ui.panel)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
          <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        </div>
        <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className={cn('my-4 border-t', ui.line)} />
      <DialogField ui={ui} lines={5} />
      <div className={cn('mt-4 border-t pt-4', ui.line)}>
        <div className="flex items-center justify-between gap-3">
          <div className={cn('text-[11px]', ui.muted)}>Live sync with document canvas</div>
          <div className="flex items-center gap-2">
            <VariantButton className={ui.secondary}>cancel</VariantButton>
            <VariantButton className={ui.primary}>apply</VariantButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderPlatformSidebar(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('grid overflow-hidden rounded-[20px]', ui.panel)} style={{ gridTemplateColumns: '92px minmax(0,1fr)' }}>
      <div className={cn('border-r p-4', ui.line)}>
        <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', ui.muted)}>mode</div>
        <div className={cn('mt-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
        <div className={cn('mt-4 text-[11px] leading-5', ui.muted)}>equation live</div>
      </div>
      <div className="p-4">
        <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
        <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        <div className="mt-4">
          <DialogField ui={ui} lines={4} withAside />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <VariantButton className={ui.secondary}>dismiss</VariantButton>
          <VariantButton className={cn('flex-1', ui.primary)} fill>commit</VariantButton>
        </div>
      </div>
    </div>
  );
}

function renderPlatformDetached(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className="space-y-3">
      <div className={cn('rounded-[20px] p-4', ui.panel)}>
        <div className="flex items-center justify-between gap-4">
          <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
          <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
            #{String(index).padStart(2, '0')}
          </div>
        </div>
        <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        <div className="mt-4">
          <DialogField ui={ui} lines={4} />
        </div>
      </div>
      <div className={cn('rounded-[18px] p-3', ui.panel)}>
        <div className="flex items-center justify-between gap-3">
          <div className={cn('text-[11px]', ui.muted)}>Toolbar detached beneath the editor.</div>
          <div className="flex items-center gap-2">
            <VariantButton className={ui.secondary}>cancel</VariantButton>
            <VariantButton className={ui.primary}>apply</VariantButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderDeveloperGithub(_ui: MathEditorVariant['ui'], index: number, summary: string) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-zinc-300 bg-white shadow-[0_1px_0_rgba(31,35,40,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-[#f6f8fa] px-4 py-3">
        <div>
          <div className="text-[15px] font-semibold text-[#1f2328]">GitHub review panel</div>
          <div className="mt-1 text-[12px] text-[#59636e]">{summary}</div>
        </div>
        <div className="rounded-full border border-[#d0d7de] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#57606a]">
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-[120px_minmax(0,1fr)]">
        <div className="border-r border-zinc-200 bg-[#f6f8fa] px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#57606a]">file</div>
          <div className="mt-3 rounded-md border border-[#d0d7de] bg-white px-3 py-2 text-[11px] font-medium text-[#1f2328]">
            equation.md
          </div>
          <div className="mt-3 text-[11px] leading-5 text-[#59636e]">Review changes inline, then submit.</div>
        </div>
        <div className="p-4">
          <div className="rounded-md border border-[#d0d7de] bg-white p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-[#57606a]">
              <span className="rounded bg-[#ddf4ff] px-2 py-1 text-[#0969da]">latex</span>
              <span>math-block</span>
            </div>
            <div className="mt-3 rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-3 font-mono text-[12px] leading-6 text-[#1f2328]">
              {'\\int_{0}^{1} x^2 \\; dx = \\frac{1}{3}'}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#59636e]">The note canvas acts like the rendered diff view.</div>
            <div className="flex items-center gap-2">
              <VariantButton className="border border-[#d0d7de] bg-white text-[#1f2328]">cancel</VariantButton>
              <VariantButton className="bg-[#2da44e] text-white">commit</VariantButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderDeveloperInspector(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[16px] p-3', ui.panel)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={cn('text-[16px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
          <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        </div>
        <div className={cn('rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_124px]">
        <DialogField ui={ui} lines={6} />
        <div className={cn('rounded-[10px] p-3', ui.field)}>
          <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', ui.muted)}>status</div>
          <div className={cn('mt-3 text-[12px] leading-6', ui.body)}>linked to node</div>
          <div className={cn('mt-2 text-[12px] leading-6', ui.body)}>render surface live</div>
          <div className={cn('mt-2 text-[12px] leading-6', ui.body)}>escape reverts</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <VariantButton className={ui.secondary}>cancel</VariantButton>
        <VariantButton className={cn('flex-1', ui.primary)} fill>apply</VariantButton>
      </div>
    </div>
  );
}

function renderDeveloperTerminal(_ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-black/70 bg-[#101112]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <div className="text-[11px] font-medium text-zinc-400">#{String(index).padStart(2, '0')}</div>
      </div>
      <div className="p-4 font-mono">
        <div className="text-[12px] text-zinc-500">$ math-editor --live-preview</div>
        <div className="mt-3 text-[16px] font-semibold text-white">{name}</div>
        <div className="mt-1 text-[12px] text-zinc-400">{summary}</div>
        <div className="mt-4 rounded-md border border-white/10 bg-black/30 p-3 text-[12px] leading-6 text-zinc-200">
          {'\\nabla \\cdot \\vec{E}=\\frac{\\rho}{\\varepsilon_0}'}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
          <VariantButton className="border border-white/10 bg-white/[0.04] text-zinc-200">cancel</VariantButton>
          <VariantButton className="bg-[#27c93f] text-[#102014]">apply</VariantButton>
        </div>
      </div>
    </div>
  );
}

function renderEditorialSheet(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[28px] p-5', ui.panel)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={cn('text-[12px] font-semibold uppercase tracking-[0.18em]', ui.muted)}>math sheet</div>
          <div className={cn('mt-2 text-[22px] font-semibold tracking-[-0.05em]', ui.title)}>{name}</div>
        </div>
        <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className={cn('mt-3 max-w-[34ch] text-[13px] leading-6', ui.muted)}>{summary}</div>
      <div className="mt-5">
        <DialogField ui={ui} lines={5} />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <VariantButton className={ui.secondary}>cancel</VariantButton>
        <VariantButton className={cn('min-w-[160px]', ui.primary)}>apply</VariantButton>
      </div>
    </div>
  );
}

function renderEditorialLedger(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('overflow-hidden rounded-[18px]', ui.panel)}>
      <div className="grid grid-cols-[120px_minmax(0,1fr)]">
        <div className={cn('border-r p-4', ui.line)}>
          <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', ui.muted)}>entry</div>
          <div className={cn('mt-3 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
            #{String(index).padStart(2, '0')}
          </div>
        </div>
        <div className="p-4">
          <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
          <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        </div>
      </div>
      <div className={cn('border-t px-4 py-4', ui.line)}>
        <DialogField ui={ui} lines={4} />
      </div>
      <div className={cn('border-t px-4 py-3', ui.line)}>
        <div className="grid grid-cols-2 gap-2">
          <VariantButton className={ui.secondary} fill>dismiss</VariantButton>
          <VariantButton className={ui.primary} fill>save</VariantButton>
        </div>
      </div>
    </div>
  );
}

function renderEditorialHero(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[24px] p-4', ui.panel)}>
      <div className={cn('rounded-[18px] px-4 py-3', ui.badge)}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">editor concept</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">#{String(index).padStart(2, '0')}</div>
        </div>
        <div className="mt-2 text-[17px] font-semibold tracking-[-0.04em]">{name}</div>
      </div>
      <div className={cn('mt-4 text-[12px] leading-6', ui.muted)}>{summary}</div>
      <div className="mt-4">
        <DialogField ui={ui} lines={4} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <VariantButton className={ui.secondary}>cancel</VariantButton>
        <VariantButton className={cn('flex-1', ui.primary)} fill>apply to note</VariantButton>
      </div>
    </div>
  );
}

function renderCompactPopover(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[16px] p-3', ui.panel)}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn('text-[15px] font-semibold tracking-[-0.03em]', ui.title)}>{name}</div>
        <div className={cn('rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className={cn('mt-1 text-[11px]', ui.muted)}>{summary}</div>
      <div className="mt-3">
        <DialogField ui={ui} lines={3} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <VariantButton className={ui.secondary}>x</VariantButton>
        <VariantButton className={cn('flex-1', ui.primary)} fill>ok</VariantButton>
      </div>
    </div>
  );
}

function renderCompactToolbar(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[16px] p-3', ui.panel)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={cn('text-[14px] font-semibold tracking-[-0.03em]', ui.title)}>{name}</div>
          <div className={cn('mt-1 text-[11px]', ui.muted)}>{summary}</div>
        </div>
        <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
      </div>
      <div className="mt-3">
        <DialogField ui={ui} lines={3} />
      </div>
      <div className={cn('mt-3 border-t pt-3', ui.line)}>
        <div className="flex items-center justify-between gap-2">
          <div className={cn('text-[11px]', ui.muted)}>inline utility bar</div>
          <div className="flex items-center gap-2">
            <VariantButton className={ui.secondary}>cancel</VariantButton>
            <VariantButton className={ui.primary}>apply</VariantButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCompactTicket(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className="relative pt-3">
      <div className={cn('absolute left-4 top-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
        #{String(index).padStart(2, '0')}
      </div>
      <div className={cn('rounded-[18px] p-3 pt-6', ui.panel)}>
        <div className={cn('text-[14px] font-semibold tracking-[-0.03em]', ui.title)}>{name}</div>
        <div className={cn('mt-1 text-[11px]', ui.muted)}>{summary}</div>
        <div className="mt-3">
          <DialogField ui={ui} lines={3} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <VariantButton className={ui.secondary} fill>dismiss</VariantButton>
          <VariantButton className={ui.primary} fill>save</VariantButton>
        </div>
      </div>
    </div>
  );
}

function renderExperimentalPinned(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('relative rounded-[22px] p-4', ui.panel)}>
      <div className={cn('absolute -left-2 top-5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
        #{String(index).padStart(2, '0')}
      </div>
      <div className="pl-6">
        <div className={cn('text-[18px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
        <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
        <div className="mt-4">
          <DialogField ui={ui} lines={5} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <VariantButton className={ui.secondary}>cancel</VariantButton>
          <VariantButton className={cn('flex-1', ui.primary)} fill>push live</VariantButton>
        </div>
      </div>
    </div>
  );
}

function renderExperimentalStage(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[26px] p-4', ui.panel)}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', ui.badge)}>
          #{String(index).padStart(2, '0')}
        </div>
        <div className={cn('text-[11px] font-medium', ui.muted)}>staged editor</div>
      </div>
      <div className={cn('mt-3 text-[20px] font-semibold tracking-[-0.05em]', ui.title)}>{name}</div>
      <div className={cn('mt-1 text-[12px] max-w-[34ch]', ui.muted)}>{summary}</div>
      <div className="mt-4 space-y-3">
        <DialogField ui={ui} lines={4} />
        <div className={cn('rounded-[10px] p-3', ui.field)}>
          <div className={cn('text-[11px] leading-5', ui.muted)}>The note surface beside the dialog acts as the only preview stage.</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <VariantButton className={ui.secondary}>revert</VariantButton>
        <VariantButton className={cn('min-w-[180px]', ui.primary)}>apply to canvas</VariantButton>
      </div>
    </div>
  );
}

function renderExperimentalRibbon(ui: MathEditorVariant['ui'], index: number, name: string, summary: string) {
  return (
    <div className={cn('rounded-[20px] p-3', ui.panel)}>
      <div className={cn('rounded-[14px] px-3 py-2', ui.badge)}>
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em]">
          <span>editor ribbon</span>
          <span>#{String(index).padStart(2, '0')}</span>
        </div>
      </div>
      <div className={cn('mt-3 text-[17px] font-semibold tracking-[-0.04em]', ui.title)}>{name}</div>
      <div className={cn('mt-1 text-[12px]', ui.muted)}>{summary}</div>
      <div className="mt-4">
        <DialogField ui={ui} lines={4} />
      </div>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <VariantButton className={ui.secondary}>back</VariantButton>
        <VariantButton className={ui.primary} fill>apply</VariantButton>
      </div>
    </div>
  );
}

function createVariant(id: number, name: string, family: FamilyId, tone: VariantTone, summary: string, renderDialog: (ui: MathEditorVariant['ui'], index: number, name: string, summary: string) => ReactElement): MathEditorVariant {
  const ui = TONES[tone];
  return {
    id,
    name,
    family,
    tone,
    summary,
    formula: FORMULAS[(id - 1) % FORMULAS.length],
    ui,
    renderDialog: () => renderDialog(ui, id, name, summary),
  };
}

const VARIANTS: MathEditorVariant[] = [
  createVariant(1, 'GitHub Review Panel', 'developer', 'light', 'Turn the editor into a code-review side panel with explicit commit language.', renderDeveloperGithub),
  createVariant(2, 'Docked Header Sheet', 'platform', 'light', 'Large header, stable proportions, document-preview message pushed into the footer.', renderPlatformTopBar),
  createVariant(3, 'Inspector Split', 'developer', 'cool', 'A right-hand inspector feel with machine-like status blocks.', renderDeveloperInspector),
  createVariant(4, 'Editorial Sheet', 'editorial', 'neutral', 'Magazine-like hierarchy with a strong title and a clean writing surface.', renderEditorialSheet),
  createVariant(5, 'Popover Ticket', 'compact', 'warm', 'A small ticket-style editor for quick corrections.', renderCompactTicket),
  createVariant(6, 'Terminal Composer', 'developer', 'dark', 'A command-line flavored math editor for technical audiences.', renderDeveloperTerminal),
  createVariant(7, 'Pinned Card', 'experimental', 'cool', 'The card feels pinned onto the page rather than floating above it.', renderExperimentalPinned),
  createVariant(8, 'Margin Sidebar', 'platform', 'neutral', 'A narrow structural rail on the left turns the panel into a tool surface.', renderPlatformSidebar),
  createVariant(9, 'Hero Ribbon', 'editorial', 'warm', 'A decorative ribbon turns the dialog into an editorial object.', renderEditorialHero),
  createVariant(10, 'Compact Toolbar', 'compact', 'light', 'The editor collapses into a dense toolbar-like panel.', renderCompactToolbar),
  createVariant(11, 'Detached Action Bar', 'platform', 'cool', 'The panel stays focused on input while actions detach below.', renderPlatformDetached),
  createVariant(12, 'Ledger Record', 'editorial', 'neutral', 'Structured like a ledger entry with rows and controlled density.', renderEditorialLedger),
  createVariant(13, 'Staged Canvas Sheet', 'experimental', 'light', 'Explains clearly that the note itself is the preview stage.', renderExperimentalStage),
  createVariant(14, 'Command Console Split', 'developer', 'dark', 'A deep-console shell with persistent action rails.', renderPlatformSidebar),
  createVariant(15, 'Minimal Mono Card', 'compact', 'dark', 'Sharp monochrome card with almost no decorative chrome.', renderCompactPopover),
  createVariant(16, 'Archive Page', 'editorial', 'warm', 'Feels like editing a preserved record rather than a temporary field.', renderEditorialSheet),
  createVariant(17, 'Utility Rail Panel', 'platform', 'cool', 'Tools become structural instead of ornamental.', renderPlatformSidebar),
  createVariant(18, 'Ribbon Stage', 'experimental', 'warm', 'A top ribbon gives the dialog a staged, directed feeling.', renderExperimentalRibbon),
  createVariant(19, 'Review Inspector', 'developer', 'light', 'A familiar engineering panel that can sit beside documentation.', renderDeveloperInspector),
  createVariant(20, 'Ticket Popover', 'compact', 'neutral', 'Small-body, high-speed editing with a visible serial marker.', renderCompactTicket),
  createVariant(21, 'Desktop Sheet', 'platform', 'light', 'A productized desktop sheet with conservative hierarchy.', renderPlatformTopBar),
  createVariant(22, 'Dark Inspector', 'developer', 'dark', 'High-contrast engineering surface with explicit state sidecar.', renderDeveloperInspector),
  createVariant(23, 'Paper Ledger', 'editorial', 'neutral', 'Makes math editing feel like filling a paper register.', renderEditorialLedger),
  createVariant(24, 'Ribbon Console', 'experimental', 'dark', 'Mixes terminal confidence with staged action framing.', renderExperimentalRibbon),
  createVariant(25, 'Quick Compose', 'compact', 'cool', 'Toolbar density, fewer distractions, direct commit path.', renderCompactToolbar),
  createVariant(26, 'Form Sheet', 'platform', 'neutral', 'Closer to a settings sheet, but tuned for equation editing.', renderPlatformTopBar),
  createVariant(27, 'Code Review Shelf', 'developer', 'light', 'Review-oriented shell that feels like examining a patch.', renderDeveloperGithub),
  createVariant(28, 'Hero Ledger', 'editorial', 'warm', 'A headline-driven dialog for formulas that need ceremony.', renderEditorialHero),
  createVariant(29, 'Pinned Stage', 'experimental', 'cool', 'Tactile and physical, with controls grounded underneath.', renderExperimentalPinned),
  createVariant(30, 'Mono Capsule', 'compact', 'dark', 'Compressed capsule with clear destructive vs. affirmative actions.', renderCompactPopover),
  createVariant(31, 'Panel Sidebar', 'platform', 'cool', 'Stable structural rail for metadata and status.', renderPlatformSidebar),
  createVariant(32, 'Maintainer Console', 'developer', 'dark', 'Looks like a maintainer tool rather than a polished app sheet.', renderDeveloperTerminal),
  createVariant(33, 'Record Card', 'editorial', 'light', 'A documentation card with a restrained action pattern.', renderEditorialSheet),
  createVariant(34, 'Staged Ribbon', 'experimental', 'light', 'Highlights that preview is external and the dialog is just a controller.', renderExperimentalRibbon),
  createVariant(35, 'Toolbar Stub', 'compact', 'neutral', 'A narrow utility-focused popup for micro-edits.', renderCompactToolbar),
  createVariant(36, 'Detached Form', 'platform', 'warm', 'Friendly form-sheet proportions with detached actions.', renderPlatformDetached),
  createVariant(37, 'Review Sidebar', 'developer', 'cool', 'A sidebar variant of a pull-request review workflow.', renderDeveloperGithub),
  createVariant(38, 'Ledger Archive', 'editorial', 'neutral', 'Record-like structure with stronger row logic.', renderEditorialLedger),
  createVariant(39, 'Pinned Recorder', 'experimental', 'warm', 'Feels like a card pinned into a research notebook.', renderExperimentalPinned),
  createVariant(40, 'Ticket Capsule', 'compact', 'warm', 'A clipped quick-edit surface with strong serial labeling.', renderCompactTicket),
  createVariant(41, 'System Sheet', 'platform', 'light', 'System-dialog discipline with measured spacing and clear footer logic.', renderPlatformTopBar),
  createVariant(42, 'Inspector Dock', 'developer', 'dark', 'Docked inspector with explicit engineering status hints.', renderDeveloperInspector),
  createVariant(43, 'Editorial Banner', 'editorial', 'warm', 'Banner-led composition with stronger story and framing.', renderEditorialHero),
  createVariant(44, 'Canvas Stage', 'experimental', 'cool', 'The panel describes itself as a controller for the live canvas.', renderExperimentalStage),
  createVariant(45, 'Micro Panel', 'compact', 'light', 'Tight and fast, designed for single-formula cleanup.', renderCompactPopover),
  createVariant(46, 'Sheet with Footer Rail', 'platform', 'neutral', 'Documented shell with a grounded footer rail.', renderPlatformDetached),
  createVariant(47, 'Maintainer Review', 'developer', 'light', 'A more explicit GitHub-adjacent shell for serious editing.', renderDeveloperGithub),
  createVariant(48, 'Record Sheet', 'editorial', 'light', 'A calmer editorial page for polished writing workflows.', renderEditorialSheet),
  createVariant(49, 'Ribbon Stage Dark', 'experimental', 'dark', 'A darker staged controller with stronger tension.', renderExperimentalRibbon),
  createVariant(50, 'Dense Toolbar', 'compact', 'dark', 'Highest-density compact option with direct, forceful actions.', renderCompactToolbar),
];

function FamilyBadge({ family }: { family: FamilyId }) {
  const labels: Record<FamilyId, string> = {
    platform: 'platform',
    developer: 'developer',
    editorial: 'editorial',
    compact: 'compact',
    experimental: 'experimental',
  };

  return <span>{labels[family]}</span>;
}

export function MathEditorDialogLab() {
  return (
    <div className="space-y-8">
      <div className="max-w-4xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Math Editor 50</div>
        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.06em] text-zinc-950 dark:text-zinc-100">
          Fifty structurally different directions for the math editor
        </h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          This gallery is rebuilt around actual layout changes: side rails, review shells, detached footers, ticket popovers, staged controllers, and a dedicated GitHub-inspired direction. Every card is numbered for quick selection.
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
                  {variant.name}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className={cn('rounded-full px-2.5 py-1 font-semibold uppercase tracking-[0.14em]', variant.ui.badge)}>
                    <FamilyBadge family={variant.family} />
                  </span>
                  <span>{variant.tone}</span>
                </div>
              </div>
              <div className="max-w-[18rem] text-right text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                {variant.summary}
              </div>
            </div>

            <div className={cn('relative mt-4 overflow-hidden rounded-[24px] p-5', variant.ui.canvas)}>
              <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <CanvasPreview ui={variant.ui} formula={variant.formula} family={variant.family} />
                {variant.renderDialog()}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
