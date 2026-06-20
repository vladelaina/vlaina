import { Fragment, useDeferredValue, useState, useRef, useEffect, useLayoutEffect, useMemo, memo, useCallback, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Icon } from '@/components/ui/icons'
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area'
import { actions as aiActions } from '@/stores/useAIStore'
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore'
import { cn } from '@/lib/utils'
import { useModelSelectorKeyboard } from './hooks/useModelSelectorKeyboard'
import { useModelSelectorScroll } from './hooks/useModelSelectorScroll'
import type { AIModel, Provider } from '@/lib/ai/types';
import { isManagedModelId, isManagedProviderId, MANAGED_PROVIDER_NAME } from '@/lib/ai/managedService'
import {
  focusComposerInput as focusRegisteredComposerInput,
  focusVisibleTextareaAt,
} from '@/lib/ui/composerFocusRegistry'
import { OPEN_SETTINGS_EVENT, type OpenSettingsDetail } from '@/components/Settings/settingsEvents'
import { useI18n } from '@/lib/i18n'
import {
  getSidebarIdleRowSurfaceClass,
  getSidebarPreviewRowSurfaceClass,
  getSidebarSelectedRowSurfaceClass,
  type SidebarTone,
} from '@/components/layout/sidebar/sidebarLabelStyles'
import { themeDomStyleTokens, themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens'
import {
  MODEL_FAMILIES,
  getModelCategoryId,
  getModelFamily,
  getModelPresentationName,
  type ModelCategory,
  type ModelCategoryId,
} from './modelFamilyRegistry'
import { getModelSelectorSearchTerm, modelMatchesSelectorSearch } from './modelSelectorSearch'
import { sortModelsForDisplay } from './modelSort'
import { chatComposerGhostIconButtonClass, chatComposerPillSurfaceClass } from './composerStyles'

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
const MODEL_SELECTOR_DROPDOWN_WIDTH = 432
const MODEL_SELECTOR_DROPDOWN_FALLBACK_MAX_HEIGHT = 460
const MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT = 'min(460px, calc(100vh - 96px))'
const MODEL_SELECTOR_LIST_HEIGHT = 'min(386px, calc(100vh - 170px))'
const monochromeModelIconClass = 'dark:invert dark:brightness-[1.08] dark:contrast-[0.92] dark:opacity-[0.92]'
const customModelIconClass = 'flex-shrink-0 text-[var(--vlaina-sidebar-chat-icon)]'

function CustomModelIcon({
  size,
  className,
}: {
  size: number | string
  className?: string
}) {
  return (
    <Icon
      name="misc.box"
      size={size}
      className={cn(customModelIconClass, className)}
      data-model-selector-custom-icon="true"
    />
  )
}

export function createModelSelectorProviderOrder(providers: Array<Pick<Provider, 'id'>>): Map<string, number> {
  return new Map(providers.map((provider, index) => [provider.id, index] as const));
}

export function compareModelSelectorProviderIds(
  providerOrder: Map<string, number>,
  leftProviderId: string,
  rightProviderId: string
): number {
  const leftManaged = isManagedProviderId(leftProviderId);
  const rightManaged = isManagedProviderId(rightProviderId);
  if (leftManaged !== rightManaged) {
    return leftManaged ? 1 : -1;
  }

  const leftOrder = providerOrder.get(leftProviderId) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = providerOrder.get(rightProviderId) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return leftProviderId.localeCompare(rightProviderId);
}

const MODEL_SELECTOR_THEME_STYLES: Record<
  ModelSelectorTheme,
  {
    triggerHover: string
    triggerText: string
    triggerTextActive: string
    sectionLabel: string
    divider: string
    inputText: string
    inputPlaceholder: string
    settingsButton: string
    categoryHover: string
    optionText: string
    optionTextActive: string
    emptyText: string
  }
> = {
  chat: {
    triggerHover: 'hover:bg-[var(--vlaina-sidebar-chat-row-hover)]',
    triggerText: 'text-[var(--vlaina-sidebar-chat-text-muted)]',
    triggerTextActive: 'text-[var(--vlaina-sidebar-chat-text)]',
    sectionLabel: 'text-[var(--vlaina-sidebar-chat-text-soft)]',
    divider: 'border-[var(--vlaina-color-model-selector-divider)]',
    inputText: 'text-[var(--vlaina-sidebar-chat-text)]',
    inputPlaceholder: 'placeholder:text-[var(--vlaina-sidebar-chat-text-soft)]',
    settingsButton: 'text-[var(--vlaina-sidebar-chat-text)]',
    categoryHover: 'hover:bg-[var(--vlaina-sidebar-chat-row-hover)]',
    optionText: 'text-[var(--vlaina-sidebar-chat-text)]',
    optionTextActive: 'text-[var(--vlaina-sidebar-row-selected-text)]',
    emptyText: 'text-[var(--vlaina-sidebar-chat-text-soft)]',
  },
  notes: {
    triggerHover: 'hover:bg-[var(--vlaina-sidebar-notes-row-hover)]',
    triggerText: 'text-[var(--vlaina-sidebar-notes-text-muted)]',
    triggerTextActive: 'text-[var(--vlaina-sidebar-notes-text)]',
    sectionLabel: 'text-[var(--vlaina-sidebar-notes-text-soft)]',
    divider: 'border-[var(--vlaina-color-model-selector-divider)]',
    inputText: 'text-[var(--vlaina-sidebar-notes-text)]',
    inputPlaceholder: 'placeholder:text-[var(--vlaina-sidebar-notes-text-soft)]',
    settingsButton: 'text-[var(--vlaina-sidebar-notes-text)]',
    categoryHover: 'hover:bg-[var(--vlaina-sidebar-notes-row-hover)]',
    optionText: 'text-[var(--vlaina-sidebar-notes-text)]',
    optionTextActive: 'text-[var(--vlaina-sidebar-row-selected-text)]',
    emptyText: 'text-[var(--vlaina-sidebar-notes-text-soft)]',
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
    showFamilyIcon,
}: {
    model: AIModel;
    isSelected: boolean;
    isFocused: boolean;
    onSelect: (id: string) => void;
    onTogglePinned: (id: string, pinned: boolean) => void;
    onHover: (id: string) => void;
    theme: ModelSelectorTheme;
    showFamilyIcon: boolean;
}) => {
    const styles = MODEL_SELECTOR_THEME_STYLES[theme]
    const sidebarTone: SidebarTone = theme
    const displayName = getModelPresentationName(model)
    const family = getModelFamily(model)

    return (
        <div
            role="button"
            tabIndex={-1}
            data-model-id={model.id}
            onClick={() => onSelect(model.id)}
            onMouseEnter={() => onHover(model.id)}
            className={cn(
                "flex w-max min-w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors duration-[var(--vlaina-duration-75)]",
                "group/model-option",
                isSelected
                  ? getSidebarSelectedRowSurfaceClass(sidebarTone)
                  : isFocused
                    ? getSidebarPreviewRowSurfaceClass(sidebarTone)
                    : getSidebarIdleRowSurfaceClass(sidebarTone)
            )}
        >
            <span className="flex min-w-0 items-center text-left">
                {showFamilyIcon && family && (
                    <img
                        src={family.icon}
                        alt=""
                        className={cn(
                          "mr-2 h-4 w-4 flex-shrink-0 rounded-[var(--vlaina-radius-3px)] object-contain",
                          family.monochromeIcon && monochromeModelIconClass
                        )}
                        draggable={false}
                    />
                )}
                <span className={cn(
                    "whitespace-nowrap text-[var(--vlaina-font-15)] font-semibold tracking-tight",
                    isSelected
                      ? styles.optionTextActive
                      : styles.optionText
                )}>
                    {displayName}
                </span>
                {model.priceTier && (
                    <span
                        className={cn(
                            "ml-2 inline-flex items-center rounded-md border px-1 py-[var(--vlaina-space-1px)] text-[7px] font-medium leading-none tracking-normal",
                            isSelected
                              ? "border-[var(--vlaina-color-sidebar-focus-ring)] text-[var(--vlaina-sidebar-row-selected-text)] opacity-[var(--vlaina-opacity-80)]"
                              : "border-[var(--vlaina-color-subtle-border)] text-[var(--vlaina-sidebar-chat-text-soft)] opacity-[var(--vlaina-opacity-60)]"
                        )}
                        title={`Price tier ${model.priceTier}`}
                    >
                        {model.priceTier}
                    </span>
                )}
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
                        "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--vlaina-color-favorite-fg)] transition-opacity",
                        model.pinned
                          ? "pointer-events-auto opacity-[var(--vlaina-opacity-100)]"
                          : "pointer-events-none opacity-[var(--vlaina-opacity-0)] text-[var(--vlaina-color-favorite-fg-muted)] hover:text-[var(--vlaina-color-favorite-fg)] group-hover/model-option:pointer-events-auto group-hover/model-option:opacity-[var(--vlaina-opacity-100)]"
                    )}
                >
                    <Icon
                        name="misc.star"
                        size="sm"
                        className={model.pinned ? "fill-current" : undefined}
                    />
                </button>
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
  dropdownLayerClassName?: string
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
  dropdownLayerClassName = "z-[var(--vlaina-z-50)]",
  focusSearchOnOpen = true,
  restoreComposerFocusOnClose = true,
}: ModelSelectorProps) {
  const { t } = useI18n()
  const models = useUnifiedStore((state) => state.data.ai?.models || [])
  const providers = useUnifiedStore((state) => state.data.ai?.providers || [])
  const selectedModelId = useUnifiedStore((state) => state.data.ai?.selectedModelId || null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<ModelCategoryId | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownContentRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const embeddedPositionFrameRef = useRef<number | null>(null)
  const [embeddedDropdownStyle, setEmbeddedDropdownStyle] = useState<CSSProperties | null>(null)

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
  const selectedModelFamily = selectedModel ? getModelFamily(selectedModel) : null

  const enabledProviderIds = useMemo(
    () => new Set(providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)),
    [providers]
  );

  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled && enabledProviderIds.has(model.providerId)),
    [enabledProviderIds, models]
  );

  const filteredModels = useMemo(() => {
      const term = getModelSelectorSearchTerm(deferredSearchQuery);
      return enabledModels.filter((model) => modelMatchesSelectorSearch(model, term));
  }, [deferredSearchQuery, enabledModels]);

  const sortedFilteredModels = useMemo(
      () => sortModelsForDisplay(filteredModels),
      [filteredModels],
  );

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
              monochromeIcon: family.monochromeIcon,
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
          return sortedFilteredModels.filter((model) => model.pinned);
      }

      return sortedFilteredModels.filter((model) => getModelCategoryId(model) === visibleActiveCategoryId);
  }, [sortedFilteredModels, visibleActiveCategoryId]);

  const groupedFilteredModels = useMemo(() => {
      const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
      const providerOrder = createModelSelectorProviderOrder(providers);
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
          .sort(([leftProviderId], [rightProviderId]) =>
              compareModelSelectorProviderIds(providerOrder, leftProviderId, rightProviderId)
          )
          .map(([providerId, providerModels]) => ({
              providerId,
              providerName: isManagedProviderId(providerId)
                ? MANAGED_PROVIDER_NAME
                : providerMap.get(providerId)?.name || t('settings.ai.unknownChannel'),
              models: providerModels,
          }));
  }, [categoryFilteredModels, providers, t]);

  const showGroupedSections = groupedFilteredModels.length > 1
      || groupedFilteredModels.some((group) => !isManagedProviderId(group.providerId));
  const emptyStateText = visibleActiveCategoryId === 'favorites'
      ? t('chat.noFavoriteModels')
      : t('chat.noModelsFound');
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
          inputRef.current?.focus({ preventScroll: true })
      }, 90);
  }, []);

  const focusComposerInput = useCallback(() => {
      if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current)
      }
      focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null
          const input = composerInputRef?.current;
          if (input instanceof HTMLTextAreaElement && focusVisibleTextareaAt(input)) {
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

  const updateEmbeddedDropdownPosition = useCallback(() => {
      if (!isEmbedded || !dropdownRef.current || typeof window === 'undefined') {
          return;
      }

      const triggerRect = dropdownRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const viewportAvailableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
      const dropdownWidth = Math.min(MODEL_SELECTOR_DROPDOWN_WIDTH, viewportAvailableWidth);
      const measuredHeight = dropdownContentRef.current?.getBoundingClientRect().height ?? 0;
      const viewportAvailableHeight = Math.max(0, window.innerHeight - viewportPadding * 2);
      const fallbackHeight = Math.min(
          MODEL_SELECTOR_DROPDOWN_FALLBACK_MAX_HEIGHT,
          Math.max(0, window.innerHeight - 96),
      );
      const dropdownHeight = Math.min(
          measuredHeight > 0 ? measuredHeight : fallbackHeight,
          viewportAvailableHeight,
      );
      const preferredLeft = dropdownAlign === 'left'
          ? triggerRect.left
          : triggerRect.right - dropdownWidth;
      const left = Math.max(
          viewportPadding,
          Math.min(
              preferredLeft,
              window.innerWidth - dropdownWidth - viewportPadding,
          ),
      );
      const preferredTop = dropdownPlacement === 'bottom'
          ? triggerRect.bottom + 4
          : triggerRect.top - dropdownHeight - 4;
      const maxTop = Math.max(viewportPadding, window.innerHeight - dropdownHeight - viewportPadding);
      const top = Math.max(viewportPadding, Math.min(preferredTop, maxTop));

      setEmbeddedDropdownStyle({
          left,
          top,
          width: dropdownWidth,
          maxHeight: MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT,
      });
  }, [dropdownAlign, dropdownPlacement, isEmbedded]);

  const scheduleEmbeddedDropdownPosition = useCallback(() => {
      if (embeddedPositionFrameRef.current !== null) {
          return;
      }

      embeddedPositionFrameRef.current = window.requestAnimationFrame(() => {
          embeddedPositionFrameRef.current = null;
          updateEmbeddedDropdownPosition();
      });
  }, [updateEmbeddedDropdownPosition]);

  useLayoutEffect(() => {
      if (!isOpen || !isEmbedded) {
          if (embeddedPositionFrameRef.current !== null) {
              window.cancelAnimationFrame(embeddedPositionFrameRef.current);
              embeddedPositionFrameRef.current = null;
          }
          setEmbeddedDropdownStyle(null);
          return;
      }

      updateEmbeddedDropdownPosition();
      window.addEventListener('resize', scheduleEmbeddedDropdownPosition);
      window.addEventListener('scroll', scheduleEmbeddedDropdownPosition, true);
      return () => {
          window.removeEventListener('resize', scheduleEmbeddedDropdownPosition);
          window.removeEventListener('scroll', scheduleEmbeddedDropdownPosition, true);
          if (embeddedPositionFrameRef.current !== null) {
              window.cancelAnimationFrame(embeddedPositionFrameRef.current);
              embeddedPositionFrameRef.current = null;
          }
      };
  }, [isEmbedded, isOpen, scheduleEmbeddedDropdownPosition, updateEmbeddedDropdownPosition]);

  const setKeyboardNavigating = useCallback((value: boolean) => {
      isKeyboardNavigating.current = value;
  }, []);

  const openSelector = useCallback(() => {
      const shouldRefreshManagedModels = selectedModel
          ? isManagedProviderId(selectedModel.providerId)
          : isManagedModelId(selectedModelId);

      if (shouldRefreshManagedModels) {
          aiActions.refreshManagedProviderInBackground({ force: true });
      }
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
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !dropdownContentRef.current?.contains(target)
      ) {
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
          ? sortedFilteredModels.find((model) => model.pinned)?.id ?? null
          : sortedFilteredModels.find((model) => getModelCategoryId(model) === categoryId)?.id ?? null;
      clearScrollMode();
      setActiveCategoryId(categoryId);
      setFocusedModelId(firstModelId);
      requestAnimationFrame(() => {
          virtualizer.scrollToIndex(0, { align: 'start' });
      });
  }, [clearScrollMode, sortedFilteredModels, virtualizer]);

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

  const dropdownContent = isOpen ? (
        <div
          ref={dropdownContentRef}
          className={cn(
            isEmbedded
              ? "fixed"
              : dropdownPlacement === 'bottom'
                ? "absolute top-full mt-1"
                : "absolute bottom-full mb-1",
            !isEmbedded && (dropdownAlign === 'left' ? "left-0" : "right-0"),
            "w-[var(--vlaina-size-27rem)]",
            "max-w-[var(--vlaina-width-model-selector-max)]",
            "rounded-[var(--vlaina-radius-26px)]",
            chatComposerPillSurfaceClass,
            "backdrop-blur-[var(--vlaina-backdrop-blur-lg)] overflow-hidden flex flex-col",
            dropdownLayerClassName,
            "animate-in fade-in duration-[var(--vlaina-duration-75)] zoom-in-95"
          )}
          data-model-selector-dropdown="true"
          style={isEmbedded
            ? embeddedDropdownStyle ?? {
                width: MODEL_SELECTOR_DROPDOWN_WIDTH,
                maxHeight: MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT,
              }
            : { maxHeight: MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT }}
        >
          <div className={cn("flex items-center gap-1 border-b px-2 py-2", styles.divider)}>
              <input
                ref={inputRef}
                type="text"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('chat.findModel')}
                autoCorrect="off"
                className={cn(
                  "h-8 min-w-0 flex-1 bg-transparent px-2 py-0 text-sm leading-5 outline-none border-none",
                  styles.inputText,
                  styles.inputPlaceholder
                )}
              />
              <button
                  onClick={() => {
                      closeSelector(false);
                      const event = new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, { detail: { tab: 'ai' } });
                      window.dispatchEvent(event);
                  }}
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center",
                    chatComposerGhostIconButtonClass,
                    styles.settingsButton
                  )}
              >
                  <Icon name="common.settings" size="md" />
              </button>
          </div>

          <div className="flex min-h-0 flex-1" style={{ height: MODEL_SELECTOR_LIST_HEIGHT }}>
            <OverlayScrollArea
              scrollbarVariant="compact"
              className={cn("w-16 flex-none border-r", styles.divider)}
              viewportClassName="p-1.5"
            >
              <div className="flex w-full flex-col items-center gap-1">
                {modelCategories.map((category, index) => {
                  const isActive = visibleActiveCategoryId === category.id;
                  const previousKind = modelCategories[index - 1]?.kind;
                  const showDividerBefore =
                    (category.kind === 'family' && previousKind === 'favorites') ||
                    (category.kind === 'custom' && previousKind === 'favorites');
                  const showDividerAfter = category.kind === 'family' && modelCategories[index + 1]?.kind === 'custom';

                  return (
                    <Fragment key={category.id}>
                      {showDividerBefore && <div className={cn("my-1 w-10 border-t", styles.divider)} />}
                      <div className="flex h-12 w-12 items-center justify-center">
                      <button
                        type="button"
                        aria-label={category.name}
                        onClick={() => handleSelectCategory(category.id)}
                        className={cn(
                          "relative flex h-12 w-12 cursor-pointer items-center justify-center transition-[background-color,box-shadow] duration-[var(--vlaina-duration-150)]",
                          isActive
                            ? "rounded-2xl bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-md)]"
                            : cn("rounded-2xl bg-transparent", styles.categoryHover)
                        )}
                      >
                        {category.kind === 'favorites' ? (
                          <Icon
                            name={category.count > 0 ? "misc.starSolid" : "misc.star"}
                            size={isActive ? 32 : "md"}
                            className="text-[var(--vlaina-color-favorite-fg)]"
                          />
                        ) : category.icon ? (
                          <img
                            src={category.icon}
                            alt=""
                            className={cn(
                              "rounded-[var(--vlaina-radius-4px)] object-contain",
                              isActive ? "h-8 w-8" : "h-5 w-5",
                              category.monochromeIcon && monochromeModelIconClass
                            )}
                            draggable={false}
                          />
                        ) : (
                          <CustomModelIcon size={isActive ? 32 : "md"} className={styles.optionText} />
                        )}
                      </button>
                      </div>
                      {showDividerAfter && <div className={cn("my-1 w-10 border-t", styles.divider)} />}
                    </Fragment>
                  )
                })}
              </div>
            </OverlayScrollArea>

            <OverlayScrollArea
              ref={listRef}
              onMouseLeave={handleListMouseLeave}
              scrollbarVariant="compact"
              className="min-w-0 flex-1"
              viewportClassName="p-1"
            >
              {listRows.length === 0 ? (
                <div className={cn("py-8 text-center text-xs", styles.emptyText)}>
                  {emptyStateText}
                </div>
              ) : (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    minWidth: themeDomStyleTokens.sizeFull,
                    position: themeDomStyleTokens.positionRelative,
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
                          left: themeDomStyleTokens.numericZero,
                          position: themeDomStyleTokens.positionAbsolute,
                          top: themeDomStyleTokens.numericZero,
                          transform: `translateY(${virtualRow.start}px)`,
                          minWidth: themeDomStyleTokens.sizeFull,
                        }}
                      >
                        {row.type === 'label' ? (
                          <div className="px-1">
                            <div
                              className={cn("px-2 pt-2 pb-1 text-[var(--vlaina-font-11)] font-medium", styles.sectionLabel)}
                              data-model-selector-provider-label={row.id.replace(/^label:/, '')}
                            >
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
                            showFamilyIcon={visibleActiveCategoryId === 'favorites'}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </OverlayScrollArea>
          </div>
        </div>
      ) : null;

  return (
    <div className="relative select-none w-fit" ref={dropdownRef}>
      <button
        onClick={toggleSelector}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-2 rounded-full px-2.5 transition-[background-color,color,box-shadow] duration-[var(--vlaina-duration-200)] group",
          chatComposerPillSurfaceClass,
          selectedModel ? styles.triggerTextActive : styles.triggerText
        )}
      >
        {selectedModelFamily ? (
          <img
            src={selectedModelFamily.icon}
            alt=""
            className={cn(
              "h-[var(--vlaina-size-18px)] w-[var(--vlaina-size-18px)] flex-shrink-0 rounded-[var(--vlaina-radius-3px)] object-contain",
              selectedModelFamily.monochromeIcon && monochromeModelIconClass
            )}
            draggable={false}
          />
        ) : (
          <CustomModelIcon size={themeIconTokens.sizeCompact} />
        )}
        <span className="whitespace-nowrap text-[var(--vlaina-font-15)] font-semibold tracking-tight">
          {selectedModel ? getModelPresentationName(selectedModel) : t('chat.selectModel')}
        </span>
        {/* Chevron glyph adapted from Lucide Icons (ISC). */}
        <svg
          className={cn("h-4 w-4 flex-shrink-0 opacity-[var(--vlaina-opacity-60)] transition-transform duration-[var(--vlaina-duration-200)]", isOpen && "rotate-180")}
          fill={themeStyleResetTokens.fillNone}
          stroke={themeStyleResetTokens.currentColor}
          strokeWidth={themeIconTokens.strokeDefault}
          viewBox={themeIconTokens.viewBoxDefault}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isEmbedded && typeof document !== 'undefined'
        ? createPortal(dropdownContent, document.body)
        : dropdownContent}
    </div>
  )
}
