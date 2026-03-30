import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import type { ProgressOrCounter, ProgressItem, CounterItem } from '@/stores/progress/useProgressStore';
import { MetadataField, MetadataInput } from './MetadataField';
import type { FocusTarget } from './useDetailModal';
import { normalizeTags } from '@/lib/tags/tagUtils';

type DraftKey = keyof ProgressItem | keyof CounterItem;

interface MetadataSectionProps {
  displayItem: ProgressOrCounter;
  isEditing: boolean;
  focusTarget: FocusTarget;
  onStartEdit: (target: FocusTarget) => void;
  onCommit: () => void;
  onUpdateDraft: (key: DraftKey, value: unknown) => void;
  onDirectUpdate: (data: Partial<ProgressOrCounter>) => void;
}

export function MetadataSection({
  displayItem,
  isEditing,
  focusTarget,
  onStartEdit,
  onCommit,
  onUpdateDraft,
  onDirectUpdate,
}: MetadataSectionProps) {
  const isProgress = displayItem.type === 'progress';

  return (
    <div
      className={`mt-2 transition-all duration-300 ${
        isEditing
          ? 'opacity-100 translate-y-0'
          : 'opacity-40 hover:opacity-100 translate-y-2'
      }`}
    >
      {isProgress ? (
        <ProgressMetadata
          displayItem={displayItem as ProgressItem}
          isEditing={isEditing}
          focusTarget={focusTarget}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onUpdateDraft={onUpdateDraft}
          onDirectUpdate={onDirectUpdate}
        />
      ) : (
        <CounterMetadata
          displayItem={displayItem}
          isEditing={isEditing}
          focusTarget={focusTarget}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onUpdateDraft={onUpdateDraft}
          onDirectUpdate={onDirectUpdate}
        />
      )}
    </div>
  );
}

interface ProgressMetadataProps {
  displayItem: ProgressItem;
  isEditing: boolean;
  focusTarget: FocusTarget;
  onStartEdit: (target: FocusTarget) => void;
  onCommit: () => void;
  onUpdateDraft: (key: DraftKey, value: unknown) => void;
  onDirectUpdate: (data: Partial<ProgressOrCounter>) => void;
}

function ProgressMetadata({
  displayItem,
  isEditing,
  focusTarget,
  onStartEdit,
  onCommit,
  onUpdateDraft,
  onDirectUpdate,
}: ProgressMetadataProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 w-full max-w-sm">
      {/* Target */}
      <div className="min-w-0">
        <MetadataField
          label="Target"
          isEditing={isEditing}
          onStartEdit={() => onStartEdit('total')}
          displayValue={displayItem.total}
        >
          <MetadataInput
            type="number"
            value={displayItem.total}
            onChange={(v) => onUpdateDraft('total', v)}
            onCommit={onCommit}
            autoFocus={focusTarget === 'total'}
          />
        </MetadataField>
      </div>

      {/* Step */}
      <div className="min-w-0">
        <MetadataField
          label="Step"
          isEditing={isEditing}
          onStartEdit={() => onStartEdit('step')}
          displayValue={displayItem.step}
        >
          <MetadataInput
            type="number"
            value={displayItem.step}
            onChange={(v) => onUpdateDraft('step', v)}
            onCommit={onCommit}
            autoFocus={focusTarget === 'step'}
          />
        </MetadataField>
      </div>

      {/* Unit */}
      <div className="min-w-0">
        <MetadataField
          label="Unit"
          isEditing={isEditing}
          onStartEdit={() => onStartEdit('unit')}
          displayValue={displayItem.unit || '—'}
          isEmpty={!displayItem.unit}
        >
          <MetadataInput
            type="text"
            value={displayItem.unit || ''}
            onChange={(v) => onUpdateDraft('unit', v)}
            onCommit={onCommit}
            autoFocus={focusTarget === 'unit'}
            placeholder="Unit"
          />
        </MetadataField>
      </div>

      {/* Reset */}
      <div className="min-w-0">
        <ResetField
          resetFrequency={displayItem.resetFrequency}
          isEditing={isEditing}
          onUpdateDraft={onUpdateDraft}
          onDirectUpdate={onDirectUpdate}
        />
      </div>

      <div className="col-span-2 min-w-0">
        <TagsField
          tags={displayItem.tags}
          isEditing={isEditing}
          focusTarget={focusTarget}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onUpdateDraft={onUpdateDraft}
        />
      </div>
    </div>
  );
}

interface CounterMetadataProps {
  displayItem: ProgressOrCounter;
  isEditing: boolean;
  focusTarget: FocusTarget;
  onStartEdit: (target: FocusTarget) => void;
  onCommit: () => void;
  onUpdateDraft: (key: DraftKey, value: unknown) => void;
  onDirectUpdate: (data: Partial<ProgressOrCounter>) => void;
}

function CounterMetadata({
  displayItem,
  isEditing,
  focusTarget,
  onStartEdit,
  onCommit,
  onUpdateDraft,
  onDirectUpdate,
}: CounterMetadataProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 w-full max-w-sm">
      {/* Step */}
      <div className="min-w-0">
        <MetadataField
          label="Step"
          isEditing={isEditing}
          onStartEdit={() => onStartEdit('step')}
          displayValue={displayItem.step}
        >
          <MetadataInput
            type="number"
            value={displayItem.step}
            onChange={(v) => onUpdateDraft('step', v)}
            onCommit={onCommit}
            autoFocus={focusTarget === 'step'}
          />
        </MetadataField>
      </div>

      {/* Unit */}
      <div className="min-w-0">
        <MetadataField
          label="Unit"
          isEditing={isEditing}
          onStartEdit={() => onStartEdit('unit')}
          displayValue={displayItem.unit || '—'}
          isEmpty={!displayItem.unit}
        >
          <MetadataInput
            type="text"
            value={displayItem.unit || ''}
            onChange={(v) => onUpdateDraft('unit', v)}
            onCommit={onCommit}
            autoFocus={focusTarget === 'unit'}
            placeholder="Unit"
          />
        </MetadataField>
      </div>

      {/* Reset */}
      <div className="col-span-2 flex justify-center">
        <ResetField
          resetFrequency={displayItem.resetFrequency}
          isEditing={isEditing}
          onUpdateDraft={onUpdateDraft}
          onDirectUpdate={onDirectUpdate}
        />
      </div>

      <div className="col-span-2 min-w-0">
        <TagsField
          tags={displayItem.tags}
          isEditing={isEditing}
          focusTarget={focusTarget}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onUpdateDraft={onUpdateDraft}
        />
      </div>
    </div>
  );
}

interface TagsFieldProps {
  tags?: string[] | null;
  isEditing: boolean;
  focusTarget: FocusTarget;
  onStartEdit: (target: FocusTarget) => void;
  onCommit: () => void;
  onUpdateDraft: (key: DraftKey, value: unknown) => void;
}

function formatTagsDisplay(tags?: string[] | null): string {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) return '—';
  return normalized.map(tag => `#${tag}`).join(' ');
}

function formatTagsInput(tags?: string[] | null): string {
  return normalizeTags(tags).join(', ');
}

function parseTagInput(value: string): string[] {
  const cleaned = value
    .split(',')
    .map(token => token.replace(/^#+/, '').trim())
    .filter(Boolean);
  return normalizeTags(cleaned);
}

function TagsField({
  tags,
  isEditing,
  focusTarget,
  onStartEdit,
  onCommit,
  onUpdateDraft,
}: TagsFieldProps) {
  const isEditingTags = isEditing && focusTarget === 'tags';
  const normalizedInput = useMemo(() => formatTagsInput(tags), [tags]);
  const [inputValue, setInputValue] = useState(normalizedInput);
  const previousEditingTagsRef = useRef(false);

  useEffect(() => {
    if (isEditingTags && !previousEditingTagsRef.current) {
      setInputValue(normalizedInput);
    }
    if (!isEditingTags) {
      setInputValue(normalizedInput);
    }
    previousEditingTagsRef.current = isEditingTags;
  }, [isEditingTags, normalizedInput]);

  return (
    <MetadataField
      label="Tags"
      isEditing={isEditing}
      onStartEdit={() => onStartEdit('tags')}
      displayValue={formatTagsDisplay(tags)}
      isEmpty={normalizeTags(tags).length === 0}
      className="items-start"
      displayClassName="text-sm leading-relaxed whitespace-normal break-words w-full"
    >
      <input
        autoFocus={focusTarget === 'tags'}
        type="text"
        value={inputValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          onUpdateDraft('tags', parseTagInput(nextValue));
        }}
        className="
          w-full bg-transparent border-none outline-none text-left
          font-medium text-sm text-zinc-900 dark:text-zinc-100
          p-0
          placeholder:text-zinc-200 dark:placeholder:text-zinc-700
        "
        placeholder="tag1, tag2"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.stopPropagation();
            onCommit();
          }
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </MetadataField>
  );
}

interface ResetFieldProps {
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  isEditing: boolean;
  onUpdateDraft: (key: DraftKey, value: unknown) => void;
  onDirectUpdate: (data: Partial<ProgressOrCounter>) => void;
}

function ResetField({
  resetFrequency,
  isEditing,
  onUpdateDraft,
  onDirectUpdate,
}: ResetFieldProps) {
  const toggleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = resetFrequency || 'none';
    const next = current === 'none' ? 'daily' : 'none';
    if (isEditing) {
      onUpdateDraft('resetFrequency', next);
    } else {
      onDirectUpdate({ resetFrequency: next });
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 group">
      <span className="text-[9px] font-bold uppercase text-zinc-300 dark:text-zinc-600 tracking-[0.25em]">
        Reset
      </span>
      {isEditing ? (
        <div
          className="flex items-center justify-center h-[28px] cursor-pointer"
          onClick={toggleReset}
        >
          <span className="text-xl font-medium text-zinc-900 dark:text-zinc-100 select-none">
            {resetFrequency === 'daily' ? 'Daily' : 'None'}
          </span>
        </div>
      ) : (
        <div
          onClick={toggleReset}
          className="flex items-center justify-center gap-1 cursor-pointer group/reset"
        >
          {resetFrequency === 'daily' ? (
            <Icon
              name="common.refresh"
              className="size-[18px] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors"
            />
          ) : (
            <span className="text-xl font-medium text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors">
              —
            </span>
          )}
        </div>
      )}
    </div>
  );
}
