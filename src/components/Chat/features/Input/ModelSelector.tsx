import { useState, useRef, useEffect, useMemo, memo, useCallback, type RefObject } from 'react'
import { Icon } from '@/components/ui/icons'
import { useAIStore } from '@/stores/useAIStore'
import { cn } from '@/lib/utils'
import { useModelSelectorKeyboard } from './hooks/useModelSelectorKeyboard'
import { useModelSelectorScroll } from './hooks/useModelSelectorScroll'
import type { AIModel } from '@/lib/ai/types';
import { isManagedProviderId, MANAGED_PROVIDER_NAME } from '@/lib/ai/managedService'

type ModelSelectorTheme = 'chat' | 'notes'

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
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors duration-75",
                (isSelected || isFocused)
                ? styles.optionActive
                : cn("bg-transparent", styles.optionHover)
            )}
        >
            <span className={cn(
                "text-sm", 
                isSelected
                  ? cn("font-semibold", styles.optionTextActive)
                  : cn("font-medium", styles.optionText)
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
  composerInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  dropdownPlacement?: 'top' | 'bottom'
  onSelectModel?: (modelId: string) => void
  theme?: ModelSelectorTheme
}

export function ModelSelector({
  composerInputRef,
  dropdownPlacement = 'top',
  onSelectModel,
  theme = 'chat',
}: ModelSelectorProps) {
  const { models, providers, selectedModelId, selectModel, getSelectedModel } = useAIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)

  const selectedModel = getSelectedModel()
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
      const term = searchQuery.toLowerCase();
      return enabledModels.filter(model => 
          model.name.toLowerCase().includes(term) ||
          model.apiModelId.toLowerCase().includes(term)
      );
  }, [enabledModels, searchQuery]);

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

  const {
      requestCenterScroll,
      requestNearestScroll,
      clearScrollMode,
  } = useModelSelectorScroll({
      isOpen,
      focusedModelId,
      listRef,
  });

  const focusSearchInput = useCallback(() => {
      setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const focusComposerInput = useCallback(() => {
      setTimeout(() => {
          const input = composerInputRef.current;
          if (input) {
              input.focus({ preventScroll: true });
              const position = input.value.length;
              input.setSelectionRange(position, position);
          }
      }, 50);
  }, [composerInputRef]);

  const setKeyboardNavigating = useCallback((value: boolean) => {
      isKeyboardNavigating.current = value;
  }, []);

  const openSelector = useCallback(() => {
      const initialFocusedId = selectedModelId ?? null;
      requestCenterScroll();
      setFocusedModelId(initialFocusedId);
      setIsOpen(true);
      focusSearchInput();
  }, [focusSearchInput, requestCenterScroll, selectedModelId]);

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
    selectModel(modelId)
    onSelectModel?.(modelId)
    closeSelector(true)
    setSearchQuery('')
  }, [closeSelector, onSelectModel, selectModel]);

  useModelSelectorKeyboard({
      isOpen,
      filteredModels,
      focusedModelId,
      setFocusedModelId,
      setKeyboardNavigating,
      onShortcutToggle: toggleSelector,
      onClose: () => closeSelector(true),
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

  return (
    <div className="relative select-none w-fit" ref={dropdownRef}>
      <button
        onClick={toggleSelector}
        className={cn(
          "flex items-center gap-1.5 px-3 h-9 rounded-full transition-all group",
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
              ? "absolute top-full right-0 mt-1 w-64"
              : "absolute bottom-full right-0 mb-1 w-64",
            "rounded-2xl shadow-xl",
            "border",
            styles.panelSurface,
            styles.panelBorder,
            "backdrop-blur-lg z-50 overflow-hidden flex flex-col",
            "animate-in fade-in duration-75 zoom-in-95" 
          )}
          style={{ maxHeight: '320px' }}
        >
          <div className={cn("flex items-center gap-1 px-1 py-2 border-b", styles.divider)}>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find model..."
                autoCorrect="off"
                className={cn(
                  "flex-1 px-2 py-0.5 bg-transparent border-none outline-none text-sm",
                  styles.inputText,
                  styles.inputPlaceholder
                )}
                autoFocus
              />
              <button
                  onClick={() => {
                      closeSelector(false);
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } });
                      window.dispatchEvent(event);
                  }}
                  className={cn("p-1.5 rounded-lg transition-colors", styles.settingsButton)}
              >
                  <Icon name="common.settings" size="md" />
              </button>
          </div>

          <div ref={listRef} className="overflow-y-auto p-1 scrollbar-none flex-1" style={{ height: '256px' }}>
            {filteredModels.length === 0 ? (
              <div className={cn("py-8 text-center text-xs", styles.emptyText)}>
                No models found
              </div>
            ) : (
              <div className={cn("flex flex-col", showGroupedSections && "gap-2")}>
                {groupedFilteredModels.map((group) => (
                  <div key={group.providerId} className={cn(showGroupedSections && "px-1")}>
                    {showGroupedSections ? (
                      <>
                        <div className={cn("px-2 pt-2 pb-1 text-[11px] font-medium", styles.sectionLabel)}>
                          {group.providerName}
                        </div>
                        <div className={cn("border-t", styles.divider)} />
                        <div className="pt-1">
                          {group.models.map(model => (
                            <ModelOption 
                              key={model.id}
                              model={model}
                              isSelected={selectedModelId === model.id}
                              isFocused={focusedModelId === model.id}
                              onSelect={handleSelectModel}
                              onHover={handleHover}
                              theme={theme}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {group.models.map(model => (
                          <ModelOption 
                            key={model.id}
                            model={model}
                            isSelected={selectedModelId === model.id}
                            isFocused={focusedModelId === model.id}
                            onSelect={handleSelectModel}
                            onHover={handleHover}
                            theme={theme}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
