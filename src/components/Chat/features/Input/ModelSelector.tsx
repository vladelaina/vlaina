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
import { SETTINGS_CLOSED_EVENT } from '@/components/Settings/settingsEvents'
import {
  MODEL_FAMILIES,
  getModelCategoryId,
  getModelDisplayName,
  type ModelCategory,
  type ModelCategoryId,
} from './modelFamilyRegistry'

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
    optionText: 'text-[var(--chat-sidebar-text)]',
    optionTextActive: 'text-[var(--sidebar-row-selected-text)]',
    checkIcon: 'text-[var(--sidebar-row-selected-text)]',
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
    optionText: 'text-[var(--notes-sidebar-text)]',
    optionTextActive: 'text-[var(--sidebar-row-selected-text)]',
    checkIcon: 'text-[var(--sidebar-row-selected-text)]',
    emptyText: 'text-[var(--notes-sidebar-text-soft)]',
  },
}

const ModelOption = memo(({ 
    model, 
    isSelected, 
    isFocused, 
    onSelect, 
    onTogglePinned,
    onHover,
    theme,
}: { 
    model: AIModel; 
    isSelected: boolean; 
    isFocused: boolean; 
    onSelect: (id: string) => void; 
    onTogglePinned: (id: string, pinned: boolean) => void;
    onHover: (id: string) => void;
    theme: ModelSelectorTheme;
}) => {
    const styles = MODEL_SELECTOR_THEME_STYLES[theme]
    const displayName = getModelDisplayName(model)

    return (
        <div
            role="button"
            tabIndex={-1}
            data-model-id={model.id}
            onClick={() => onSelect(model.id)}
            onMouseEnter={() => onHover(model.id)}
            className={cn(
                "flex w-max min-w-full cursor-pointer items-center justify-between px-3 py-2 rounded-md text-left transition-colors duration-75",
                "group/model-option",
                isSelected
                  ? styles.optionActive
                  : isFocused
                    ? styles.optionFocused
                    : cn("bg-transparent", styles.optionHover)
            )}
        >
            <span className={cn(
                "whitespace-nowrap text-sm font-medium",
                isSelected
                  ? styles.optionTextActive
                  : styles.optionText
            )}>
                {displayName}
            </span>

            <span className="ml-3 flex flex-shrink-0 items-center gap-1">
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={model.pinned ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={(event) => {
                        event.stopPropagation();
                        onTogglePinned(model.id, !model.pinned);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        onTogglePinned(model.id, !model.pinned);
                    }}
                    className={cn(
                        "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-amber-500 transition-opacity",
                        model.pinned
                          ? "pointer-events-auto opacity-100"
                          : "pointer-events-none opacity-0 text-amber-500/70 hover:text-amber-500 group-hover/model-option:pointer-events-auto group-hover/model-option:opacity-100"
                    )}
                >
                    <Icon
                        name="misc.star"
                        size="sm"
                        className={model.pinned ? "fill-current" : undefined}
                    />
                </button>

                <Icon
                    name="common.check"
                    size="md"
                    className={cn(
                        "flex-shrink-0",
                        isSelected ? styles.checkIcon : "opacity-0"
                    )}
                />
            </span>
        </div>
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
  const [activeCategoryId, setActiveCategoryId] = useState<ModelCategoryId | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)
  const reopenAfterSettingsCloseRef = useRef(false)
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

  const modelCategories = useMemo(() => {
      const categoryCounts = new Map<ModelCategoryId, number>();

      filteredModels.forEach((model) => {
          const categoryId = getModelCategoryId(model);
          categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
      });

      const categories: ModelCategory[] = [];
      const pinnedCount = filteredModels.filter((model) => model.pinned).length;
      categories.push({
          id: 'favorites',
          name: 'Favorites',
          icon: null,
          kind: 'favorites',
          count: pinnedCount,
      });

      MODEL_FAMILIES.forEach((family) => {
          const count = categoryCounts.get(family.id) ?? 0;
          if (count === 0) {
              return;
          }
          categories.push({
              id: family.id,
              name: family.name,
              icon: family.icon,
              kind: 'family',
              count,
          });
      });

      const customCount = categoryCounts.get('custom') ?? 0;
      if (customCount > 0) {
          categories.push({
              id: 'custom',
              name: 'Custom',
              icon: null,
              kind: 'custom',
              count: customCount,
          });
      }

      return categories;
  }, [filteredModels]);

  const visibleActiveCategoryId = useMemo(() => {
      if (activeCategoryId && modelCategories.some((category) => category.id === activeCategoryId)) {
          return activeCategoryId;
      }

      const selectedCategoryId = selectedModel ? getModelCategoryId(selectedModel) : null;
      if (selectedCategoryId && modelCategories.some((category) => category.id === selectedCategoryId)) {
          return selectedCategoryId;
      }

      return modelCategories.find((category) => category.id !== 'favorites')?.id ?? modelCategories[0]?.id ?? null;
  }, [activeCategoryId, modelCategories, selectedModel]);

  const categoryFilteredModels = useMemo(() => {
      if (!visibleActiveCategoryId) {
          return [];
      }

      if (visibleActiveCategoryId === 'favorites') {
          return filteredModels.filter((model) => model.pinned);
      }

      return filteredModels.filter((model) => getModelCategoryId(model) === visibleActiveCategoryId);
  }, [filteredModels, visibleActiveCategoryId]);

  const groupedFilteredModels = useMemo(() => {
      const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
      const modelsByProvider = new Map<string, AIModel[]>();

      categoryFilteredModels.forEach((model) => {
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
  }, [categoryFilteredModels, providers]);

  const showGroupedSections = visibleActiveCategoryId !== 'favorites' || groupedFilteredModels.length > 1;
  const emptyStateText = visibleActiveCategoryId === 'favorites'
      ? 'No favorite models'
      : 'No models found';
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
      const initialCategoryId = selectedModel
          ? getModelCategoryId(selectedModel)
          : modelCategories.find((category) => category.id !== 'favorites')?.id ?? modelCategories[0]?.id ?? null;
      const initialFocusedId = selectedModelId ?? null;
      requestCenterScroll();
      setActiveCategoryId(initialCategoryId);
      setFocusedModelId(initialFocusedId);
      setIsOpen(true);
      if (focusSearchOnOpen) {
          focusSearchInput();
      }
  }, [focusSearchOnOpen, focusSearchInput, modelCategories, requestCenterScroll, selectedModel, selectedModelId]);

  const closeSelector = useCallback((restoreComposerFocus = false) => {
      clearScrollMode();
      setSearchQuery('');
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
      const handleSettingsClosed = () => {
          if (!reopenAfterSettingsCloseRef.current) {
              return;
          }
          reopenAfterSettingsCloseRef.current = false;
          window.requestAnimationFrame(() => {
              openSelector();
          });
      };

      window.addEventListener(SETTINGS_CLOSED_EVENT, handleSettingsClosed);
      return () => {
          window.removeEventListener(SETTINGS_CLOSED_EVENT, handleSettingsClosed);
      };
  }, [openSelector]);

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
  }, [closeSelector, onSelectModel, restoreComposerFocusOnClose]);

  const handleTogglePinned = useCallback((modelId: string, pinned: boolean) => {
      aiActions.updateModel(modelId, { pinned });
  }, []);

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

  const handleSelectCategory = useCallback((categoryId: ModelCategoryId) => {
      const firstModelId = categoryId === 'favorites'
          ? filteredModels.find((model) => model.pinned)?.id ?? null
          : filteredModels.find((model) => getModelCategoryId(model) === categoryId)?.id ?? null;
      clearScrollMode();
      setActiveCategoryId(categoryId);
      setFocusedModelId(firstModelId);
      requestAnimationFrame(() => {
          virtualizer.scrollToIndex(0, { align: 'start' });
      });
  }, [clearScrollMode, filteredModels, virtualizer]);

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

  useEffect(() => {
      if (!isOpen) {
          return;
      }

      if (focusedModelId && visibleModelIds.includes(focusedModelId)) {
          return;
      }

      const nextFocusedId = selectedModelId && visibleModelIds.includes(selectedModelId)
          ? selectedModelId
          : visibleModelIds[0] ?? null;
      setFocusedModelId(nextFocusedId);
  }, [focusedModelId, isOpen, selectedModelId, visibleModelIds]);

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
          {selectedModel ? getModelDisplayName(selectedModel) : 'Select Model'}
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
            isEmbedded ? "w-[23rem]" : "w-[27rem]",
            "max-w-[calc(100vw-24px)]",
            "rounded-2xl shadow-xl",
            "border",
            styles.panelSurface,
            styles.panelBorder,
            "backdrop-blur-lg z-50 overflow-hidden flex flex-col",
            "animate-in fade-in duration-75 zoom-in-95" 
          )}
          style={{ maxHeight: 'min(460px, calc(100vh - 96px))' }}
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
                      reopenAfterSettingsCloseRef.current = true;
                      closeSelector(false);
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } });
                      window.dispatchEvent(event);
                  }}
                  className={cn("flex-shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors", styles.settingsButton)}
              >
                  <Icon name="common.settings" size="md" />
              </button>
          </div>

          <div className="flex min-h-0 flex-1" style={{ height: 'min(386px, calc(100vh - 170px))' }}>
            <div className={cn("w-16 flex-shrink-0 overflow-y-auto overflow-x-hidden border-r p-1.5 vlaina-scrollbar", styles.divider)}>
              <div className="flex w-full flex-col items-center gap-1">
                {modelCategories.map((category, index) => {
                  const isActive = visibleActiveCategoryId === category.id;
                  const previousKind = modelCategories[index - 1]?.kind;
                  const showDividerBefore =
                    (category.kind === 'family' && previousKind === 'favorites') ||
                    (category.kind === 'custom' && previousKind === 'favorites');
                  const showDividerAfter = category.kind === 'family' && modelCategories[index + 1]?.kind === 'custom';

                  return (
                    <div key={category.id} className="flex w-12 justify-center">
                      {showDividerBefore && <div className={cn("my-1 border-t", styles.divider)} />}
                      <button
                        type="button"
                        aria-label={category.name}
                        onClick={() => handleSelectCategory(category.id)}
                        className={cn(
                          "relative flex cursor-pointer items-center justify-center transition-[background-color,box-shadow,width,height,border-radius] duration-150",
                          isActive
                            ? "h-12 w-12 rounded-2xl bg-[#fcfcfc] shadow-md"
                            : cn("h-9 w-9 rounded-lg bg-transparent", styles.optionHover)
                        )}
                      >
                        {category.kind === 'favorites' ? (
                          <Icon
                            name={category.count > 0 ? "misc.starSolid" : "misc.star"}
                            size={isActive ? 32 : "md"}
                            className="text-amber-500"
                          />
                        ) : category.icon ? (
                          <img
                            src={category.icon}
                            alt=""
                            className={cn(
                              "rounded-[4px] object-contain",
                              isActive ? "h-8 w-8" : "h-5 w-5"
                            )}
                            draggable={false}
                          />
                        ) : (
                          <Icon name="misc.box" size={isActive ? 32 : "md"} className={styles.optionText} />
                        )}
                      </button>
                      {showDividerAfter && <div className={cn("my-1 border-t", styles.divider)} />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              ref={listRef}
              onMouseLeave={handleListMouseLeave}
              className="min-w-0 flex-1 overflow-auto p-1 vlaina-scrollbar"
            >
              {listRows.length === 0 ? (
                <div className={cn("py-8 text-center text-xs", styles.emptyText)}>
                  {emptyStateText}
                </div>
              ) : (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    minWidth: '100%',
                    position: 'relative',
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
                          minWidth: '100%',
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
                            onTogglePinned={handleTogglePinned}
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
        </div>
      )}
    </div>
  )
}
