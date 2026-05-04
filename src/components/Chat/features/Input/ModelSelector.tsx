import { useDeferredValue, useState, useRef, useEffect, useMemo, memo, useCallback, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Icon } from '@/components/ui/icons'
import { actions as aiActions } from '@/stores/useAIStore'
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore'
import { cn } from '@/lib/utils'
import { useModelSelectorKeyboard } from './hooks/useModelSelectorKeyboard'
import { useModelSelectorScroll } from './hooks/useModelSelectorScroll'
import type { AIModel } from '@/lib/ai/types';
import { isManagedProviderId, MANAGED_PROVIDER_NAME } from '@/lib/ai/managedService'
import { focusComposerInput as focusRegisteredComposerInput } from '@/lib/ui/composerFocusRegistry'

type ModelSelectorTheme = 'chat' | 'notes'
type ModelSelectorListRow =
  | {
      type: 'label'
      id: string
      providerName: string
    }
  | {
      type: 'model'
      id: string
      model: AIModel
    }

const MODEL_SELECTOR_LABEL_HEIGHT = 34
const MODEL_SELECTOR_ROW_HEIGHT = 40

const MODEL_SELECTOR_THEME_STYLES: Record<
  ModelSelectorTheme,
  {
    triggerHover: string
    triggerText: string
    triggerTextActive: string
    panelSurface: string
    panelBorder: string
    sectionLabel: string
    divider: string
    inputText: string
    inputPlaceholder: string
    settingsButton: string
    optionHover: string
    optionActive: string
    optionFocused: string
    optionText: string
    optionTextActive: string
    checkIcon: string
    emptyText: string
  }
> = {
  chat: {
    triggerHover: 'hover:bg-[var(--chat-sidebar-row-hover)]',
    triggerText: 'text-[var(--chat-sidebar-text-muted)]',
    triggerTextActive: 'text-[var(--chat-sidebar-text)]',
    panelSurface: 'bg-[var(--chat-sidebar-surface)]',
    panelBorder: 'border-neutral-100 dark:border-neutral-600/40',
    sectionLabel: 'text-[var(--chat-sidebar-text-soft)]',
    divider: 'border-neutral-100 dark:border-neutral-700',
    inputText: 'text-[var(--chat-sidebar-text)]',
    inputPlaceholder: 'placeholder:text-[var(--chat-sidebar-text-soft)]',
    settingsButton: 'text-[var(--chat-sidebar-icon)] hover:text-[var(--chat-sidebar-icon-hover)]',
    optionHover: 'hover:bg-[var(--chat-sidebar-row-hover)]',
    optionActive: 'bg-[var(--chat-sidebar-row-active)]',
    optionFocused: 'bg-[var(--chat-sidebar-row-hover)]',
    optionText: 'text-[var(--chat-sidebar-text-muted)]',
    optionTextActive: 'text-[var(--chat-sidebar-text)]',
    checkIcon: 'text-[var(--chat-sidebar-text)]',
    emptyText: 'text-[var(--chat-sidebar-text-soft)]',
  },
  notes: {
    triggerHover: 'hover:bg-[var(--notes-sidebar-row-hover)]',
    triggerText: 'text-[var(--notes-sidebar-text-muted)]',
    triggerTextActive: 'text-[var(--notes-sidebar-text)]',
    panelSurface: 'bg-[var(--notes-sidebar-surface)]',
    panelBorder: 'border-[var(--notes-sidebar-menu-border)]',
    sectionLabel: 'text-[var(--notes-sidebar-text-soft)]',
    divider: 'border-[var(--notes-sidebar-menu-border)]',
    inputText: 'text-[var(--notes-sidebar-text)]',
    inputPlaceholder: 'placeholder:text-[var(--notes-sidebar-text-soft)]',
    settingsButton: 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]',
    optionHover: 'hover:bg-[var(--notes-sidebar-row-hover)]',
    optionActive: 'bg-[var(--notes-sidebar-row-active)]',
    optionFocused: 'bg-[var(--notes-sidebar-row-hover)]',
    optionText: 'text-[var(--notes-sidebar-text-muted)]',
    optionTextActive: 'text-[var(--notes-sidebar-text)]',
    checkIcon: 'text-[var(--notes-sidebar-text)]',
    emptyText: 'text-[var(--notes-sidebar-text-soft)]',
  },
}

const ModelOption = memo(({ 
    model, 
    isSelected, 
    isFocused, 
    onSelect, 
    onHover,
    theme,
}: { 
    model: AIModel; 
    isSelected: boolean; 
    isFocused: boolean; 
    onSelect: (id: string) => void; 
    onHover: (id: string) => void;
    theme: ModelSelectorTheme;
}) => {
    const styles = MODEL_SELECTOR_THEME_STYLES[theme]

    return (
        <button
            data-model-id={model.id}
            onClick={() => onSelect(model.id)}
            onMouseEnter={() => onHover(model.id)}
            className={cn(
                "w-full flex cursor-pointer items-center justify-between px-3 py-2 rounded-md text-left transition-colors duration-75",
                isSelected
                  ? styles.optionActive
                  : isFocused
                    ? styles.optionFocused
                    : cn("bg-transparent", styles.optionHover)
            )}
        >
            <span className={cn(
                "text-sm font-medium",
                isSelected
                  ? styles.optionTextActive
                  : styles.optionText
            )}>
                {model.name}
            </span>

            {isSelected && (
                <Icon name="common.check" size="md" className={cn("ml-4 flex-shrink-0", styles.checkIcon)} />
            )}
        </button>
    );
});

interface ModelSelectorProps {
  composerInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  dropdownPlacement?: 'top' | 'bottom'
  dropdownAlign?: 'left' | 'right'
  onSelectModel?: (modelId: string) => void
  theme?: ModelSelectorTheme
  isEmbedded?: boolean
  focusSearchOnOpen?: boolean
  restoreComposerFocusOnClose?: boolean
}

export function ModelSelector({
  composerInputRef,
  dropdownPlacement = 'top',
  dropdownAlign = 'right',
  onSelectModel,
  theme = 'chat',
  isEmbedded = false,
  focusSearchOnOpen = true,
  restoreComposerFocusOnClose = true,
}: ModelSelectorProps) {
  const models = useUnifiedStore((state) => state.data.ai?.models || [])
  const providers = useUnifiedStore((state) => state.data.ai?.providers || [])
  const selectedModelId = useUnifiedStore((state) => state.data.ai?.selectedModelId || null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return undefined
    }

    const model = models.find((item) => item.id === selectedModelId)
    if (!model) {
      return undefined
    }

    const provider = providers.find((item) => item.id === model.providerId)
    return provider?.enabled === false ? undefined : model
  }, [models, providers, selectedModelId])
  const styles = MODEL_SELECTOR_THEME_STYLES[theme]

  const enabledProviderIds = useMemo(
    () => new Set(providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)),
    [providers]
  );

  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled && enabledProviderIds.has(model.providerId)),
    [enabledProviderIds, models]
  );

  const filteredModels = useMemo(() => {
      const term = deferredSearchQuery.toLowerCase();
      return enabledModels.filter(model => 
          model.name.toLowerCase().includes(term) ||
          model.apiModelId.toLowerCase().includes(term)
      );
  }, [deferredSearchQuery, enabledModels]);

  const groupedFilteredModels = useMemo(() => {
      const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
      const modelsByProvider = new Map<string, AIModel[]>();

      filteredModels.forEach((model) => {
          const existing = modelsByProvider.get(model.providerId);
          if (existing) {
              existing.push(model);
              return;
          }
          modelsByProvider.set(model.providerId, [model]);
      });

      return Array.from(modelsByProvider.entries())
          .sort(([leftProviderId], [rightProviderId]) => {
              const leftManaged = isManagedProviderId(leftProviderId);
              const rightManaged = isManagedProviderId(rightProviderId);
              if (leftManaged !== rightManaged) {
                  return leftManaged ? 1 : -1;
              }

              const leftProvider = providerMap.get(leftProviderId);
              const rightProvider = providerMap.get(rightProviderId);
              const leftCreatedAt = leftProvider?.createdAt ?? 0;
              const rightCreatedAt = rightProvider?.createdAt ?? 0;
              return leftCreatedAt - rightCreatedAt;
          })
          .map(([providerId, providerModels]) => ({
              providerId,
              providerName: isManagedProviderId(providerId)
                ? MANAGED_PROVIDER_NAME
                : providerMap.get(providerId)?.name || 'Unknown Channel',
              models: providerModels,
          }));
  }, [filteredModels, providers]);

  const showGroupedSections = groupedFilteredModels.length > 1;
  const listRows = useMemo<ModelSelectorListRow[]>(() => {
      return groupedFilteredModels.flatMap((group) => {
          const rows: ModelSelectorListRow[] = [];
          if (showGroupedSections) {
              rows.push({
                  type: 'label',
                  id: `label:${group.providerId}`,
                  providerName: group.providerName,
              });
          }
          group.models.forEach((model) => {
              rows.push({
                  type: 'model',
                  id: model.id,
                  model,
              });
          });
          return rows;
      });
  }, [groupedFilteredModels, showGroupedSections]);
  const visibleModelIds = useMemo(
      () => listRows.flatMap((row) => (row.type === 'model' ? [row.model.id] : [])),
      [listRows],
  );
  const focusedRowIndex = useMemo(
      () => listRows.findIndex((row) => row.type === 'model' && row.model.id === focusedModelId),
      [focusedModelId, listRows],
  );
  const virtualizer = useVirtualizer({
      count: listRows.length,
      getScrollElement: () => listRef.current,
      estimateSize: (index) => listRows[index]?.type === 'label'
        ? MODEL_SELECTOR_LABEL_HEIGHT
        : MODEL_SELECTOR_ROW_HEIGHT,
      overscan: 10,
  });

  const {
      requestCenterScroll,
      requestNearestScroll,
      clearScrollMode,
  } = useModelSelectorScroll({
      isOpen,
      focusedIndex: focusedRowIndex,
      scrollToIndex: (index, align) => {
          virtualizer.scrollToIndex(index, { align });
      },
  });

  const focusSearchInput = useCallback(() => {
      if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current)
      }
      focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null
          inputRef.current?.focus()
      }, 50);
  }, []);

  const focusComposerInput = useCallback(() => {
      if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current)
      }
      focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null
          const input = composerInputRef?.current;
          if (input) {
              input.focus({ preventScroll: true });
              const position = input.value.length;
              input.setSelectionRange(position, position);
              return;
          }
          focusRegisteredComposerInput();
      }, 50);
  }, [composerInputRef]);

  useEffect(() => {
      return () => {
          if (focusTimerRef.current !== null) {
              clearTimeout(focusTimerRef.current)
              focusTimerRef.current = null
          }
      }
  }, [])

  const setKeyboardNavigating = useCallback((value: boolean) => {
      isKeyboardNavigating.current = value;
  }, []);

  const openSelector = useCallback(() => {
      const initialFocusedId = selectedModelId ?? null;
      requestCenterScroll();
      setFocusedModelId(initialFocusedId);
      setIsOpen(true);
      if (focusSearchOnOpen) {
          focusSearchInput();
      }
  }, [focusSearchOnOpen, focusSearchInput, requestCenterScroll, selectedModelId]);

  const closeSelector = useCallback((restoreComposerFocus = false) => {
      clearScrollMode();
      setIsOpen(false);
      if (restoreComposerFocus) {
          focusComposerInput();
      }
  }, [clearScrollMode, focusComposerInput]);

  const toggleSelector = useCallback(() => {
      if (isOpen) {
          closeSelector(false);
          return;
      }
      openSelector();
  }, [closeSelector, isOpen, openSelector]);

  useEffect(() => {
      const handleMouseMove = () => {
          isKeyboardNavigating.current = false;
      };
      if (isOpen) {
          window.addEventListener('mousemove', handleMouseMove);
          return () => window.removeEventListener('mousemove', handleMouseMove);
      }
  }, [isOpen]);

  const handleSelectModel = useCallback((modelId: string) => {
    aiActions.selectModel(modelId)
    onSelectModel?.(modelId)
    closeSelector(restoreComposerFocusOnClose)
    setSearchQuery('')
  }, [closeSelector, onSelectModel, restoreComposerFocusOnClose]);

  useModelSelectorKeyboard({
      isOpen,
      visibleModelIds,
      focusedModelId,
      setFocusedModelId,
      setKeyboardNavigating,
      onShortcutToggle: toggleSelector,
      onClose: () => closeSelector(restoreComposerFocusOnClose),
      onSelectModel: handleSelectModel,
      requestNearestScroll,
      clearScrollMode,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeSelector(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside, true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [closeSelector, isOpen])

  const handleHover = useCallback((id: string) => {
      if (!isKeyboardNavigating.current) {
          clearScrollMode();
          setFocusedModelId(id);
      }
  }, [clearScrollMode]);

  const handleListMouseLeave = useCallback(() => {
      if (isKeyboardNavigating.current) {
          return;
      }
      clearScrollMode();
      setFocusedModelId(selectedModelId ?? null);
  }, [clearScrollMode, selectedModelId]);

  useEffect(() => {
      virtualizer.measure();
  }, [listRows, virtualizer]);

  return (
    <div className="relative select-none w-fit" ref={dropdownRef}>
      <button
        onClick={toggleSelector}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 transition-all group",
          "bg-transparent border-none",
          styles.triggerHover,
          selectedModel ? styles.triggerTextActive : styles.triggerText
        )}
      >
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedModel ? selectedModel.name : 'Select Model'}
        </span>
        <svg
          className={cn("h-5 w-5 opacity-70 transition-transform duration-200", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className={cn(
            dropdownPlacement === 'bottom'
              ? "absolute top-full mt-1"
              : "absolute bottom-full mb-1",
            dropdownAlign === 'left' ? "left-0" : "right-0",
            isEmbedded ? "w-[15.5rem]" : "w-64",
            "rounded-2xl shadow-xl",
            "border",
            styles.panelSurface,
            styles.panelBorder,
            "backdrop-blur-lg z-50 overflow-hidden flex flex-col",
            "animate-in fade-in duration-75 zoom-in-95" 
          )}
          style={{ maxHeight: '320px' }}
        >
          <div className={cn("flex items-center gap-1 border-b px-2 py-2", styles.divider)}>
              <input
                ref={inputRef}
                type="text"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find model..."
                autoCorrect="off"
                className={cn(
                  "min-w-0 flex-1 bg-transparent px-2 py-0.5 text-sm outline-none border-none",
                  styles.inputText,
                  styles.inputPlaceholder
                )}
                autoFocus={focusSearchOnOpen}
              />
              <button
                  onClick={() => {
                      closeSelector(false);
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } });
                      window.dispatchEvent(event);
                  }}
                  className={cn("flex-shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors", styles.settingsButton)}
              >
                  <Icon name="common.settings" size="md" />
              </button>
          </div>

          <div
            ref={listRef}
            onMouseLeave={handleListMouseLeave}
            className="overflow-y-auto p-1 scrollbar-none flex-1"
            style={{ height: '256px' }}
          >
            {listRows.length === 0 ? (
              <div className={cn("py-8 text-center text-xs", styles.emptyText)}>
                No models found
              </div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                  width: '100%',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = listRows[virtualRow.index]
                  if (!row) {
                    return null
                  }

                  return (
                    <div
                      key={row.id}
                      style={{
                        height: `${virtualRow.size}px`,
                        left: 0,
                        position: 'absolute',
                        top: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        width: '100%',
                      }}
                    >
                      {row.type === 'label' ? (
                        <div className="px-1">
                          <div className={cn("px-2 pt-2 pb-1 text-[11px] font-medium", styles.sectionLabel)}>
                            {row.providerName}
                          </div>
                          <div className={cn("border-t", styles.divider)} />
                        </div>
                      ) : (
                        <ModelOption 
                          model={row.model}
                          isSelected={selectedModelId === row.model.id}
                          isFocused={focusedModelId === row.model.id}
                          onSelect={handleSelectModel}
                          onHover={handleHover}
                          theme={theme}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
