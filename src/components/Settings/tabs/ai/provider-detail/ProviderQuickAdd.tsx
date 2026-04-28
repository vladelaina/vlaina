import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { cn } from '@/lib/utils';
import {
  parseQuickAddModelIds,
  replaceTrailingQuickAddSegment,
} from './ProviderModelListParts';

interface ProviderQuickAddProps {
  value: string;
  error: string;
  sortedFetchedModels: string[];
  providerModelIdSet: Set<string>;
  onValueChange: (value: string) => void;
  onAddAllVisible: (modelIds: string[]) => void;
  onSetError: (message: string) => void;
}

export function ProviderQuickAdd({
  value,
  error,
  sortedFetchedModels,
  providerModelIdSet,
  onValueChange,
  onAddAllVisible,
  onSetError,
}: ProviderQuickAddProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const quickAddIds = parseQuickAddModelIds(value);
  const quickAddSegments = value.split(/[,\uFF0C]/);
  const quickAddQuery = quickAddSegments[quickAddSegments.length - 1]?.trim() ?? '';
  const queuedQuickAddIds = new Set(quickAddIds.slice(0, -1).map((id) => id.toLowerCase()));
  const suggestions = quickAddQuery
    ? sortedFetchedModels.filter((modelId) => {
        const normalizedModelId = modelId.toLowerCase();
        return (
          !providerModelIdSet.has(normalizedModelId) &&
          !queuedQuickAddIds.has(normalizedModelId) &&
          normalizedModelId.includes(quickAddQuery.toLowerCase())
        );
      })
    : [];
  const showSuggestions = isFocused && suggestions.length > 0;

  useEffect(() => {
    if (suggestions.length === 0) {
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((current) => Math.min(current, suggestions.length - 1));
  }, [suggestions]);

  useEffect(() => {
    if (!showSuggestions) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, showSuggestions]);

  const selectSuggestion = (modelId: string) => {
    onValueChange(replaceTrailingQuickAddSegment(value, modelId));
    if (error) onSetError('');
  };

  const submit = (modelId?: string) => {
    const nextValue = modelId ? replaceTrailingQuickAddSegment(value, modelId) : value;
    const nextModelIds = parseQuickAddModelIds(nextValue);
    const dedupedModelIds = nextModelIds.filter((id, index) => {
      const normalizedId = id.toLowerCase();
      return nextModelIds.findIndex((item) => item.toLowerCase() === normalizedId) === index;
    });

    if (dedupedModelIds.length === 0) return;

    const addableModelIds = dedupedModelIds.filter((id) => !providerModelIdSet.has(id.toLowerCase()));
    if (addableModelIds.length > 0) {
      onAddAllVisible(addableModelIds);
    }

    onSetError('');
    onValueChange('');
    setHighlightedIndex(0);
    setIsFocused(false);
  };

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="relative">
        <SettingsTextInput
          type="text"
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => {
            setIsFocused(true);
            onValueChange(e.target.value);
            setHighlightedIndex(0);
            if (error) onSetError('');
          }}
          onKeyDown={(e) => {
            if (showSuggestions && e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((current) => Math.min(current + 1, suggestions.length - 1));
              return;
            }

            if (showSuggestions && e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (showSuggestions && e.key === 'Escape') {
              e.preventDefault();
              setIsFocused(false);
              return;
            }

            if (e.key === 'Enter') {
              e.preventDefault();
              if (showSuggestions) {
                submit(suggestions[highlightedIndex]);
                return;
              }
              submit();
            }
          }}
          placeholder="Add a model ID"
        />
        {showSuggestions ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border border-zinc-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="max-h-64 overflow-y-auto p-1.5">
              {suggestions.map((modelId, index) => (
                <button
                  key={modelId}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(modelId)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'flex w-full items-center rounded-[16px] px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors',
                    index === highlightedIndex
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                  )}
                >
                  <span className="truncate">{modelId}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Add models"
        onClick={() => submit()}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Icon name="common.add" size="md" />
      </button>
    </div>
  );
}
