import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import {
  LINK_EDITOR_VARIANTS,
  type LinkEditorAction,
  type LinkEditorDensity,
  type LinkEditorField,
  type LinkEditorLayout,
  type LinkEditorShell,
  type LinkEditorVariant,
} from '../variants/linkEditorVariants';

const sampleLinkText = 'launch brief';
const sampleTextValue = 'Launch brief';
const sampleUrlValue = 'https://neko.app/launch';

function getShellClasses(shell: LinkEditorShell) {
  switch (shell) {
    case 'line':
      return {
        card: 'border-zinc-200 bg-white',
        canvas: 'border-zinc-200 bg-white',
        editor: 'border-zinc-200 bg-white rounded-[18px] shadow-none',
        body: 'text-zinc-700',
        muted: 'text-zinc-500',
        selection: 'bg-zinc-100 text-zinc-900',
        button: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
        primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
      };
    case 'card':
      return {
        card: 'border-zinc-200 bg-white',
        canvas: 'border-zinc-200 bg-zinc-50/40',
        editor: 'border-zinc-200 bg-white rounded-[20px] shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
        body: 'text-zinc-700',
        muted: 'text-zinc-500',
        selection: 'bg-zinc-100 text-zinc-900',
        button: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
        primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
      };
    case 'soft':
      return {
        card: 'border-zinc-200 bg-zinc-50/50',
        canvas: 'border-zinc-200 bg-zinc-50/60',
        editor: 'border-zinc-200/70 bg-white rounded-[22px] shadow-none',
        body: 'text-zinc-700',
        muted: 'text-zinc-500',
        selection: 'bg-white text-zinc-900 shadow-[0_0_0_1px_rgba(24,24,27,0.08)]',
        button: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
        primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
      };
    case 'capsule':
      return {
        card: 'border-zinc-200 bg-white',
        canvas: 'border-zinc-200 bg-white',
        editor: 'border-zinc-200 bg-white rounded-[999px] shadow-none',
        body: 'text-zinc-700',
        muted: 'text-zinc-500',
        selection: 'bg-zinc-200 text-zinc-900 rounded-full',
        button: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 rounded-full',
        primary: 'bg-zinc-950 text-white hover:bg-zinc-800 rounded-full',
      };
    case 'panel':
      return {
        card: 'border-zinc-200 bg-white',
        canvas: 'border-zinc-200 bg-zinc-50/40',
        editor: 'border-zinc-200 bg-zinc-50/70 rounded-[16px] shadow-none',
        body: 'text-zinc-700',
        muted: 'text-zinc-500',
        selection: 'bg-white text-zinc-900 border border-zinc-200',
        button: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
        primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
      };
  }
}

function getDensityClasses(density: LinkEditorDensity) {
  switch (density) {
    case 'airy':
      return {
        frame: 'p-4',
        field: 'h-10 px-3.5',
        text: 'text-[12.5px]',
        label: 'text-[10px]',
      };
    case 'balanced':
      return {
        frame: 'p-3.5',
        field: 'h-9 px-3',
        text: 'text-[12px]',
        label: 'text-[10px]',
      };
    case 'compact':
      return {
        frame: 'p-3',
        field: 'h-8 px-2.5',
        text: 'text-[11.5px]',
        label: 'text-[9px]',
      };
  }
}

function getFieldClasses(field: LinkEditorField) {
  switch (field) {
    case 'plain':
      return 'border-0 border-b border-zinc-200 rounded-none bg-transparent';
    case 'outlined':
      return 'border border-zinc-200 rounded-[12px] bg-white';
    case 'filled':
      return 'border border-transparent rounded-[12px] bg-zinc-100/90';
    case 'underlined':
      return 'border-0 border-b border-zinc-300 rounded-none bg-transparent';
    case 'capsule':
      return 'border border-zinc-200 rounded-full bg-white';
    case 'split':
      return 'border border-zinc-200 rounded-[10px] bg-white';
  }
}

function getOverlayClasses(layout: LinkEditorLayout) {
  switch (layout) {
    case 'stacked':
      return 'left-1/2 top-[118px] w-[min(330px,calc(100%-48px))] -translate-x-1/2';
    case 'rail':
      return 'left-5 top-[120px] w-[min(360px,calc(100%-40px))]';
    case 'strip':
      return 'left-1/2 top-[146px] w-[min(430px,calc(100%-48px))] -translate-x-1/2';
    case 'ribbon':
      return 'left-5 top-[158px] w-[calc(100%-40px)]';
    case 'inspector':
      return 'right-5 top-5 w-[208px]';
    case 'split':
      return 'left-5 top-[118px] w-[min(420px,calc(100%-40px))]';
  }
}

function Field({
  label,
  value,
  icon,
  field,
  density,
}: {
  label: string;
  value: string;
  icon: string;
  field: LinkEditorField;
  density: ReturnType<typeof getDensityClasses>;
}) {
  return (
    <div className={cn(getFieldClasses(field), field === 'plain' || field === 'underlined' ? 'pb-2' : density.field)}>
      <div className="flex items-center gap-2">
        <Icon name={icon as never} size="sm" className="text-zinc-400" />
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium uppercase tracking-[0.16em] text-zinc-400', density.label)}>{label}</div>
          <div className={cn('truncate font-medium text-zinc-800', density.text)}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  action,
  shell,
}: {
  action: LinkEditorAction;
  shell: ReturnType<typeof getShellClasses>;
}) {
  if (action === 'check') {
    return (
      <button type="button" className={cn('inline-flex size-8 items-center justify-center border', shell.primary)}>
        <Icon name="common.check" size="md" />
      </button>
    );
  }

  if (action === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium border', shell.button)}>
          Cancel
        </button>
        <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium', shell.primary)}>
          Apply
        </button>
      </div>
    );
  }

  if (action === 'right') {
    return (
      <div className="flex items-center justify-end gap-2">
        <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium border', shell.button)}>
          Open
        </button>
        <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium', shell.primary)}>
          Save
        </button>
      </div>
    );
  }

  if (action === 'footer') {
    return (
      <div className="grid gap-2 pt-1">
        <button type="button" className={cn('inline-flex h-8 items-center justify-center text-[11px] font-medium', shell.primary)}>
          Apply link
        </button>
        <button type="button" className={cn('inline-flex h-8 items-center justify-center px-3 text-[11px] font-medium border', shell.button)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium border', shell.button)}>
        Cancel
      </button>
      <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium', shell.primary)}>
        Apply
      </button>
    </div>
  );
}

function FloatingEditor({ variant }: { variant: LinkEditorVariant }) {
  const shell = getShellClasses(variant.shell);
  const density = getDensityClasses(variant.density);

  if (variant.layout === 'strip') {
    return (
      <div className={cn('border', shell.editor, density.frame)}>
        <div className="flex items-center gap-2">
          <div className={cn('min-w-0 flex-1', getFieldClasses(variant.field), density.field)}>
            <div className="flex items-center gap-2">
              <Icon name="common.tag" size="sm" className="text-zinc-400" />
              <span className={cn('truncate font-medium text-zinc-800', density.text)}>{sampleTextValue}</span>
            </div>
          </div>
          <div className={cn('min-w-0 flex-[1.2]', getFieldClasses(variant.field), density.field)}>
            <div className="flex items-center gap-2">
              <Icon name="nav.external" size="sm" className="text-zinc-400" />
              <span className={cn('truncate font-medium text-zinc-800', density.text)}>{sampleUrlValue}</span>
            </div>
          </div>
          <ActionRow action={variant.action} shell={shell} />
        </div>
      </div>
    );
  }

  if (variant.layout === 'ribbon') {
    return (
      <div className={cn('border', shell.editor, density.frame)}>
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Link</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className={cn('min-w-0 flex-1', getFieldClasses(variant.field), density.field)}>
            <div className="flex items-center gap-2">
              <Icon name="nav.external" size="sm" className="text-zinc-400" />
              <span className={cn('truncate font-medium text-zinc-800', density.text)}>{sampleUrlValue}</span>
            </div>
          </div>
          <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium border', shell.button)}>
            Text
          </button>
          <button type="button" className={cn('inline-flex h-8 items-center px-3 text-[11px] font-medium', shell.primary)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (variant.layout === 'inspector') {
    return (
      <div className={cn('border', shell.editor, density.frame)}>
        <div className="grid gap-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Link</div>
          <Field label="Text" value={sampleTextValue} icon="common.tag" field={variant.field} density={density} />
          <Field label="Url" value={sampleUrlValue} icon="nav.external" field={variant.field} density={density} />
          <ActionRow action={variant.action} shell={shell} />
        </div>
      </div>
    );
  }

  if (variant.layout === 'split') {
    return (
      <div className={cn('border', shell.editor, density.frame)}>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-[11px] leading-5 text-zinc-500">
            Edit link
          </div>
          <div className="grid gap-2.5">
            <Field label="Text" value={sampleTextValue} icon="common.tag" field={variant.field} density={density} />
            <Field label="Url" value={sampleUrlValue} icon="nav.external" field={variant.field} density={density} />
            <ActionRow action={variant.action} shell={shell} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border', shell.editor, density.frame)}>
      <div className="grid gap-2.5">
        <Field label="Text" value={sampleTextValue} icon="common.tag" field={variant.field} density={density} />
        <Field label="Url" value={sampleUrlValue} icon="nav.external" field={variant.field} density={density} />
        <ActionRow action={variant.action} shell={shell} />
      </div>
    </div>
  );
}

function NoteCanvas({ variant }: { variant: LinkEditorVariant }) {
  const shell = getShellClasses(variant.shell);

  return (
    <div className={cn('relative min-h-[310px] overflow-hidden rounded-[24px] border p-5', shell.canvas)}>
      <div className={cn('max-w-[420px] text-[13px] leading-7', shell.body)}>
        We want a cleaner way to edit{' '}
        <span className={cn('px-1.5 py-0.5 font-medium', shell.selection)}>{sampleLinkText}</span>{' '}
        without turning the paragraph into a busy control surface.
      </div>
      <div className={cn('mt-4 max-w-[380px] text-[12px] leading-6', shell.muted)}>
        The editor should feel like part of the note, not a separate mini app.
      </div>
      <div className={cn('absolute', getOverlayClasses(variant.layout))}>
        <FloatingEditor variant={variant} />
      </div>
    </div>
  );
}

function VariantCard({ variant, index }: { variant: LinkEditorVariant; index: number }) {
  const shell = getShellClasses(variant.shell);

  return (
    <article className={cn('rounded-[28px] border p-5', shell.card)}>
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-mono text-zinc-500">
          {index + 1}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-zinc-900">{variant.name}</h3>
          <p className="mt-1 text-[12px] leading-5 text-zinc-500">{variant.description}</p>
        </div>
      </div>
      <div className="mt-4">
        <NoteCanvas variant={variant} />
      </div>
    </article>
  );
}

export function LinkEditorLab() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 pb-24">
      <div className="grid gap-3 rounded-[28px] border border-zinc-200 bg-white p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          <Icon name="misc.lab" size="sm" />
          Link Editor Lab
        </div>
        <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-zinc-950">
          Thirty simpler directions
        </h1>
        <p className="max-w-3xl text-[14px] leading-7 text-zinc-600">
          Everything here is intentionally reduced. No color play. No extra decoration. The difference is only shape,
          spacing, grouping, and control placement.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        {LINK_EDITOR_VARIANTS.map((variant, index) => (
          <VariantCard key={variant.id} variant={variant} index={index} />
        ))}
      </div>
    </div>
  );
}
