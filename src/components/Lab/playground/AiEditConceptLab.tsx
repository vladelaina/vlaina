import { cn } from '@/lib/utils';
import {
  AI_EDIT_CONCEPT_RESULT_TEXT,
  AI_EDIT_CONCEPT_SELECTED_TEXT,
  AI_EDIT_CONCEPTS,
  type AiEditConcept,
} from '../variants/aiEditConceptVariants';

function MiniPill({
  children,
  strong = false,
  className,
}: {
  children: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-[11px] font-medium',
        strong ? 'bg-zinc-950 text-white' : 'border border-zinc-200 bg-white text-zinc-600',
        className
      )}
    >
      {children}
    </span>
  );
}

function MiniField({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('rounded-[14px] border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-[12px] text-zinc-600', className)}>
      {children}
    </div>
  );
}

function MiniText({
  children,
  subtle = false,
}: {
  children: string;
  subtle?: boolean;
}) {
  return (
    <div className={cn('text-[12px] leading-5', subtle ? 'text-zinc-500' : 'text-zinc-800')}>
      {children}
    </div>
  );
}

function SelectionBlock() {
  return (
    <div className="rounded-[16px] border border-zinc-200 bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Selected</div>
      <div className="mt-2 rounded-[12px] bg-zinc-100 px-2.5 py-2 text-[12px] leading-5 text-zinc-800">
        {AI_EDIT_CONCEPT_SELECTED_TEXT}
      </div>
    </div>
  );
}

function ResultBlock({ mode }: { mode: AiEditConcept['preview'] }) {
  if (mode === 'none') {
    return null;
  }

  if (mode === 'inline') {
    return (
      <div className="rounded-[14px] border border-zinc-200 bg-white px-3 py-2">
        <MiniText>{AI_EDIT_CONCEPT_RESULT_TEXT}</MiniText>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <MiniField>{AI_EDIT_CONCEPT_SELECTED_TEXT}</MiniField>
      <div className="rounded-[14px] border border-zinc-200 bg-white px-3 py-2">
        <MiniText>{AI_EDIT_CONCEPT_RESULT_TEXT}</MiniText>
      </div>
    </div>
  );
}

function ControlsRow({ concept }: { concept: AiEditConcept }) {
  if (concept.controls === 'minimal') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <MiniPill strong>Translate</MiniPill>
        <MiniPill>Prompt</MiniPill>
      </div>
    );
  }

  if (concept.controls === 'balanced') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <MiniPill strong>Preset</MiniPill>
        <MiniPill>Model</MiniPill>
        <MiniPill>Prompt</MiniPill>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <MiniPill strong>Preset</MiniPill>
        <MiniPill>Model</MiniPill>
        <MiniPill>Tone</MiniPill>
      </div>
      <MiniField>Add instruction</MiniField>
    </div>
  );
}

function ConceptSurface({ concept }: { concept: AiEditConcept }) {
  const template = concept.template;

  if (template === 'inline-pill') {
    return (
      <div className="grid gap-3">
        <SelectionBlock />
        <div className="flex flex-wrap items-center gap-2 px-1">
          <MiniPill strong>Translate</MiniPill>
          <MiniPill>Refine</MiniPill>
          <MiniPill>Compare</MiniPill>
        </div>
        <ResultBlock mode={concept.preview} />
      </div>
    );
  }

  if (template === 'inline-card') {
    return (
      <div className="grid gap-3">
        <SelectionBlock />
        <div className="rounded-[18px] border border-zinc-200 bg-white p-3">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'anchor-bubble') {
    return (
      <div className="relative min-h-[176px]">
        <SelectionBlock />
        <div className="absolute left-6 top-[110px] w-[220px] rounded-[20px] border border-zinc-200 bg-white p-3 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'anchor-stack') {
    return (
      <div className="relative min-h-[216px]">
        <SelectionBlock />
        <div className="absolute left-4 top-[106px] w-[252px] rounded-[22px] border border-zinc-200 bg-zinc-50 p-2">
          <div className="rounded-[18px] border border-zinc-200 bg-white p-3">
            <ControlsRow concept={concept} />
          </div>
          <div className="mt-2 rounded-[18px] border border-zinc-200 bg-white p-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'bottom-bar') {
    return (
      <div className="relative min-h-[188px]">
        <SelectionBlock />
        <div className="absolute inset-x-0 bottom-0 rounded-[20px] border border-zinc-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ControlsRow concept={concept} />
            <MiniPill strong>Run</MiniPill>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'bottom-sheet') {
    return (
      <div className="relative min-h-[224px]">
        <SelectionBlock />
        <div className="absolute inset-x-0 bottom-0 rounded-t-[24px] border border-zinc-200 bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.05)]">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'side-peek') {
    return (
      <div className="grid grid-cols-[1fr_128px] gap-3">
        <SelectionBlock />
        <div className="rounded-[18px] border border-zinc-200 bg-white p-3">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'side-sheet') {
    return (
      <div className="grid grid-cols-[1fr_152px] gap-3">
        <SelectionBlock />
        <div className="rounded-[20px] border border-zinc-200 bg-white p-3">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  if (template === 'document-block') {
    return (
      <div className="grid gap-3">
        <SelectionBlock />
        <div className="rounded-[18px] border border-dashed border-zinc-300 bg-zinc-50 p-3">
          <ControlsRow concept={concept} />
          <div className="mt-3">
            <ResultBlock mode={concept.preview} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MiniPill strong>1. Choose action</MiniPill>
        <MiniPill>2. Review</MiniPill>
        <MiniPill>3. Apply</MiniPill>
      </div>
      <div className="rounded-[18px] border border-zinc-200 bg-white p-3">
        <SelectionBlock />
        <div className="mt-3">
          <ResultBlock mode={concept.preview} />
        </div>
      </div>
    </div>
  );
}

function FamilyLabel({ family }: { family: AiEditConcept['family'] }) {
  const labels: Record<AiEditConcept['family'], string> = {
    inline: 'Inline',
    anchor: 'Anchor',
    bottom: 'Bottom',
    side: 'Side',
    document: 'Document',
    staged: 'Staged',
  };

  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {labels[family]}
    </span>
  );
}

function EditabilityLabel({ editable }: { editable: AiEditConcept['editable'] }) {
  const labels: Record<AiEditConcept['editable'], string> = {
    source: 'Source editable',
    result: 'Result editable',
    both: 'Both editable',
  };

  return <div className="text-[11px] text-zinc-400">{labels[editable]}</div>;
}

function AiEditConceptPreview({ concept, index }: { concept: AiEditConcept; index: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-mono font-bold text-zinc-500">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-zinc-900">{concept.name}</h3>
              <FamilyLabel family={concept.family} />
            </div>
            <p className="mt-1 text-[12px] leading-5 text-zinc-500">{concept.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,#fafafa,#f4f4f5)] p-5">
        <div className="mx-auto w-full max-w-[460px] rounded-[24px] border border-zinc-200 bg-white p-4">
          <ConceptSurface concept={concept} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] leading-5 text-zinc-500">{concept.rationale}</div>
        <EditabilityLabel editable={concept.editable} />
      </div>
    </div>
  );
}

export function AiEditConceptLab() {
  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Edit Concept Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          30 broader directions for AI editing selected text
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          These are concept studies, not skin variations. Some ideas stay attached to the selection, some dock to the edge, some become part of the document itself, and some split the flow into two calmer steps.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {AI_EDIT_CONCEPTS.map((concept, index) => (
          <AiEditConceptPreview key={concept.id} concept={concept} index={index} />
        ))}
      </div>
    </div>
  );
}
