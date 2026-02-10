import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react'
import { Icon } from '@/components/ui/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useAIStore } from '@/stores/useAIStore'
import { groupModels } from '@/lib/ai/utils'
import { cn } from '@/lib/utils'
import { getModelLogoById } from '@/components/Settings/tabs/ai/modelIcons'
import type { AIModel } from '@/lib/ai/types';

const ModelOption = memo(({ 
    model, 
    isSelected, 
    isFocused, 
    onSelect, 
    onTogglePin,
    onHover 
}: { 
    model: AIModel; 
    isSelected: boolean; 
    isFocused: boolean; 
    onSelect: (id: string) => void; 
    onTogglePin: (e: React.MouseEvent, id: string, pinned?: boolean) => void;
    onHover: (id: string) => void;
}) => {
    const logo = getModelLogoById(model.id);
    
    return (
        <button
            data-model-id={model.id}
            onClick={() => onSelect(model.id)}
            onMouseEnter={() => onHover(model.id)}
            className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md",
                "text-left transition-colors group relative",
                (isSelected || isFocused)
                ? "bg-[#f5f5f5] dark:bg-[#222]"
                : "bg-transparent hover:bg-gray-50 dark:hover:bg-zinc-900"
            )}
        >
            {logo && (
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <img src={logo} alt="" className="w-full h-full object-cover rounded-full" />
                </div>
            )}
            <div className="flex-1 min-w-0 flex items-center justify-between">
                <span className={cn(
                    "text-xs truncate font-medium",
                    isSelected ? "text-black dark:text-white" : "text-gray-800 dark:text-gray-200"
                )}>
                    {model.name}
                </span>
                
                <div className="flex items-center gap-2">
                    <div 
                        onClick={(e) => onTogglePin(e, model.id, model.pinned)}
                        className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700",
                            model.pinned && "opacity-100 text-gray-900 dark:text-gray-100"
                        )}
                    >
                        {model.pinned ? <Icon name="ai.pin" size="sm" /> : <Icon name="ai.pinOutline" size="sm" className="text-gray-400" />}
                    </div>
                </div>
            </div>
        </button>
    );
});

export function ModelSelector() {
  const { models, selectedModelId, selectModel, getSelectedModel, updateModel } = useAIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isKeyboardNavigating = useRef(false)

  const selectedModel = getSelectedModel()
  const selectedModelLogo = selectedModel ? getModelLogoById(selectedModel.id) : undefined;

  const enabledModels = useMemo(() => models.filter(m => m.enabled), [models]);
  const pinnedModels = useMemo(() => enabledModels.filter(m => m.pinned), [enabledModels]);
  const unpinnedModels = useMemo(() => enabledModels.filter(m => !m.pinned), [enabledModels]);

  const groupedModels = useMemo(() => groupModels(unpinnedModels), [unpinnedModels]);

  const filteredGroups = useMemo(() => {
      return Object.entries(groupedModels).reduce((acc, [group, groupModels]) => {
        const filtered = groupModels.filter(model =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
        if (filtered.length > 0) {
          acc[group] = filtered
        }
        return acc
      }, {} as Record<string, typeof enabledModels>)
  }, [groupedModels, searchQuery]);

  const filteredPinned = useMemo(() => {
      return pinnedModels.filter(model => 
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [pinnedModels, searchQuery]);

  const flatModels = useMemo(() => {
      const sortedGroups = Object.entries(filteredGroups).sort();
      const sortedUnpinned = sortedGroups.map(([_, models]) => models).flat();
      return [...filteredPinned, ...sortedUnpinned];
  }, [filteredPinned, filteredGroups]);

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
                const idx = flatModels.findIndex(m => m.id === curr);
                const nextIdx = idx === -1 ? 0 : (idx + 1) % flatModels.length;
                return flatModels[nextIdx]?.id || curr;
            });
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            isKeyboardNavigating.current = true;
            setFocusedModelId(curr => {
                const idx = flatModels.findIndex(m => m.id === curr);
                const prevIdx = idx === -1 ? flatModels.length - 1 : (idx - 1 + flatModels.length) % flatModels.length;
                return flatModels[prevIdx]?.id || curr;
            });
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedModelId) {
                handleSelectModel(focusedModelId);
            } else if (flatModels.length > 0) {
                handleSelectModel(flatModels[0].id);
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
  }, [isOpen, flatModels, focusedModelId]);

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
          requestAnimationFrame(() => {
              const activeItem = dropdownRef.current?.querySelector(`[data-model-id="${selectedModelId}"]`);
              if (activeItem) {
                  activeItem.scrollIntoView({ block: 'center', behavior: 'instant' });
              }
          });
      } else if (isOpen) {
          setFocusedModelId(null);
      }
  }, [isOpen]);

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

  const handleTogglePin = useCallback((e: React.MouseEvent, modelId: string, currentPinned?: boolean) => {
      e.stopPropagation();
      updateModel(modelId, { pinned: !currentPinned });
  }, [updateModel]);

  return (
    <div className="relative select-none" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-1 py-1.5 rounded-md transition-all",
          "bg-transparent",
          "text-gray-700 dark:text-gray-300"
        )}
      >
        {selectedModelLogo && (
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <img src={selectedModelLogo} alt="" className="w-full h-full object-cover rounded-full" />
            </div>
        )}
        <span className="text-sm font-medium whitespace-nowrap select-none">
          {selectedModel ? selectedModel.name : 'Select Model'}
        </span>
        <Icon name="nav.chevronDown" className={cn(
          "w-4 h-4 transition-transform text-gray-400 dark:text-gray-500",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute bottom-full right-0 mb-2 w-72",
                "bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl",
                "border border-gray-200 dark:border-gray-800",
                "z-50 overflow-hidden flex flex-col select-none"
              )}
              style={{ maxHeight: '400px' }}
            >
              <div className="p-2 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-[#1E1E1E] z-10">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                      <Icon name="common.search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className={cn(
                          "w-full pl-8 pr-3 py-1.5 rounded-lg",
                          "bg-gray-50 dark:bg-zinc-900",
                          "text-xs text-gray-900 dark:text-gray-100",
                          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                          "focus:outline-none focus:ring-1 focus:ring-gray-400"
                        )}
                        autoFocus
                      />
                  </div>
                  <button
                      onClick={() => {
                          setIsOpen(false);
                          const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } });
                          window.dispatchEvent(event);
                      }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                      <Icon name="common.settings" size="sm" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-1 scrollbar-thin flex-1">
                {filteredPinned.length === 0 && Object.keys(filteredGroups).length === 0 ? (
                  <div className="py-8 text-center select-none">
                    <p className="text-xs text-gray-500">
                      {searchQuery ? 'No models found' : 'No models configured'}
                    </p>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
                        window.dispatchEvent(event)
                      }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Configure models
                    </button>
                  </div>
                ) : (
                  <>
                      {filteredPinned.length > 0 && (
                        <div className="mb-1">
                            <div className="mt-0.5 space-y-0.5">
                                {filteredPinned.map(model => (
                                    <ModelOption 
                                        key={model.id}
                                        model={model}
                                        isSelected={selectedModelId === model.id}
                                        isFocused={focusedModelId === model.id}
                                        onSelect={handleSelectModel}
                                        onTogglePin={handleTogglePin}
                                        onHover={(id) => {
                                            if (!isKeyboardNavigating.current) {
                                                setFocusedModelId(id);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1 mx-2" />
                        </div>
                      )}

                      {Object.entries(filteredGroups).sort().map(([group, groupModels]) => (
                        <div key={group} className="mb-0.5">
                          <div className="mt-0.5 space-y-0.5">
                            {groupModels.map(model => (
                                <ModelOption 
                                    key={model.id}
                                    model={model}
                                    isSelected={selectedModelId === model.id}
                                    isFocused={focusedModelId === model.id}
                                    onSelect={handleSelectModel}
                                    onTogglePin={handleTogglePin}
                                    onHover={(id) => {
                                        if (!isKeyboardNavigating.current) {
                                            setFocusedModelId(id);
                                        }
                                    }}
                                />
                            ))}
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
