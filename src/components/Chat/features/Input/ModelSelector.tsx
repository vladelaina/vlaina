import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react'
import { Icon } from '@/components/ui/icons'
import { useAIStore } from '@/stores/useAIStore'
import { cn } from '@/lib/utils'
import type { AIModel } from '@/lib/ai/types';

const ModelOption = memo(({ 
    model, 
    isSelected, 
    isFocused, 
    onSelect, 
    onHover 
}: { 
    model: AIModel; 
    isSelected: boolean; 
    isFocused: boolean; 
    onSelect: (id: string) => void; 
    onHover: (id: string) => void;
}) => {
    return (
        <button
            data-model-id={model.id}
            onClick={() => onSelect(model.id)}
            onMouseEnter={() => onHover(model.id)}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors duration-75",
                (isSelected || isFocused)
                ? "bg-neutral-100 dark:bg-neutral-700/60"
                : "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-700/60"
            )}
        >
            <span className={cn(
                "text-sm", 
                isSelected ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-600 dark:text-gray-400"
            )}>
                {model.name}
            </span>
            
            {isSelected && (
                <Icon name="common.check" size="md" className="text-gray-900 dark:text-gray-100 ml-4 flex-shrink-0" />
            )}
        </button>
    );
});

export function ModelSelector() {
  const { models, selectedModelId, selectModel, getSelectedModel } = useAIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)

  const selectedModel = getSelectedModel()

  const enabledModels = useMemo(() => models.filter(m => m.enabled), [models]);

  const filteredModels = useMemo(() => {
      const term = searchQuery.toLowerCase();
      return enabledModels.filter(model => 
          model.name.toLowerCase().includes(term) ||
          model.id.toLowerCase().includes(term)
      );
  }, [enabledModels, searchQuery]);

  useEffect(() => {
      const handleMouseMove = () => {
          isKeyboardNavigating.current = false;
      };
      if (isOpen) {
          window.addEventListener('mousemove', handleMouseMove);
          return () => window.removeEventListener('mousemove', handleMouseMove);
      }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const isMod = e.metaKey || e.ctrlKey;
        
        if (isMod && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            setIsOpen(prev => {
                const next = !prev;
                if (next) {
                    setFocusedModelId(null);
                    setTimeout(() => inputRef.current?.focus(), 50);
                }
                return next;
            });
            return;
        }

        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            isKeyboardNavigating.current = true;
            setFocusedModelId(curr => {
                const idx = filteredModels.findIndex(m => m.id === curr);
                const nextIdx = idx === -1 ? 0 : (idx + 1) % filteredModels.length;
                return filteredModels[nextIdx]?.id || curr;
            });
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            isKeyboardNavigating.current = true;
            setFocusedModelId(curr => {
                const idx = filteredModels.findIndex(m => m.id === curr);
                const prevIdx = idx === -1 ? filteredModels.length - 1 : (idx - 1 + filteredModels.length) % filteredModels.length;
                return filteredModels[prevIdx]?.id || curr;
            });
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedModelId) {
                handleSelectModel(focusedModelId);
            } else if (filteredModels.length > 0) {
                handleSelectModel(filteredModels[0].id);
            }
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            setTimeout(() => {
                const input = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
                if (input) input.focus();
            }, 50);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredModels, focusedModelId]);

  useEffect(() => {
      if (isOpen && focusedModelId && dropdownRef.current) {
          const activeItem = dropdownRef.current.querySelector(`[data-model-id="${focusedModelId}"]`);
          if (activeItem) {
              activeItem.scrollIntoView({ block: 'nearest', behavior: 'instant' } as any);
          }
      }
  }, [focusedModelId, isOpen]);

  useEffect(() => {
      if (isOpen && selectedModelId) {
          setFocusedModelId(selectedModelId);
      } else if (isOpen) {
          setFocusedModelId(null);
      }
  }, [isOpen, selectedModelId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectModel = useCallback((modelId: string) => {
    selectModel(modelId)
    setIsOpen(false)
    setSearchQuery('')
    
    setTimeout(() => {
        const input = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
        if (input) input.focus();
    }, 50);
  }, [selectModel]);

  const handleHover = useCallback((id: string) => {
      if (!isKeyboardNavigating.current) {
          setFocusedModelId(id);
      }
  }, []);

  return (
    <div className="relative select-none w-fit" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 h-9 rounded-full transition-all group",
          "bg-transparent border-none",
          "text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
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
            "absolute bottom-full right-0 mb-1 w-64",
            "bg-white dark:bg-neutral-800 rounded-2xl shadow-xl",
            "border border-neutral-100 dark:border-neutral-600/40",
            "backdrop-blur-lg z-50 overflow-hidden flex flex-col",
            "animate-in fade-in duration-75 zoom-in-95" 
          )}
          style={{ maxHeight: '320px' }}
        >
          <div className="flex items-center gap-1 px-1 py-2 border-b border-neutral-100 dark:border-neutral-700">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find model..."
                autoCorrect="off"
                className="flex-1 px-2 py-0.5 bg-transparent border-none outline-none text-sm text-neutral-800 dark:text-white placeholder:text-neutral-400"
                autoFocus
              />
              <button
                  onClick={() => {
                      setIsOpen(false);
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } });
                      window.dispatchEvent(event);
                  }}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                  <Icon name="common.settings" size="md" />
              </button>
          </div>

          <div className="overflow-y-auto p-1 scrollbar-none flex-1" style={{ height: '256px' }}>
            {filteredModels.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                No models found
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredModels.map(model => (
                                            <ModelOption 
                                                key={model.id}
                                                model={model}
                                                isSelected={selectedModelId === model.id}
                                                isFocused={focusedModelId === model.id}
                                                onSelect={handleSelectModel}
                                                onHover={handleHover}
                                            />                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
