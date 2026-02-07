import { useState, useRef, useEffect } from 'react'
import { MdExpandMore, MdSearch, MdSmartToy, MdCheck, MdPushPin, MdPushPin as MdPushPinOutlined } from 'react-icons/md'
import { useAIStore } from '@/stores/useAIStore'
import { groupModels } from '@/lib/ai/utils'
import { cn } from '@/lib/utils'
import { getModelLogoById } from '@/components/Settings/tabs/ai/modelIcons'

export function ModelSelector() {
  const { models, selectedModelId, selectModel, getSelectedModel, updateModel } = useAIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModel = getSelectedModel()
  const selectedModelLogo = selectedModel ? getModelLogoById(selectedModel.id) : undefined;

  const enabledModels = models.filter(m => m.enabled)
  
  // Separate pinned models
  const pinnedModels = enabledModels.filter(m => m.pinned);
  const unpinnedModels = enabledModels.filter(m => !m.pinned);

  const groupedModels = groupModels(unpinnedModels)

  const filteredGroups = Object.entries(groupedModels).reduce((acc, [group, groupModels]) => {
    const filtered = groupModels.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[group] = filtered
    }
    return acc
  }, {} as Record<string, typeof enabledModels>)

  // Handle pinned models in search
  const filteredPinned = pinnedModels.filter(model => 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleSelectModel = (modelId: string) => {
    selectModel(modelId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleTogglePin = (e: React.MouseEvent, modelId: string, currentPinned?: boolean) => {
      e.stopPropagation();
      updateModel(modelId, { pinned: !currentPinned });
  };

  const renderModelItem = (model: typeof enabledModels[0]) => {
      const logo = getModelLogoById(model.id);
      const isSelected = selectedModelId === model.id;
      return (
        <button
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md",
                "text-left transition-colors group relative",
                isSelected
                ? "bg-gray-100 dark:bg-zinc-800"
                : "hover:bg-gray-50 dark:hover:bg-zinc-900"
            )}
        >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {logo ? (
                    <img src={logo} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300">
                        {model.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between">
                <span className={cn(
                    "text-xs truncate font-medium",
                    isSelected ? "text-black dark:text-white" : "text-gray-800 dark:text-gray-200"
                )}>
                    {model.name}
                </span>
                
                <div className="flex items-center gap-2">
                    {/* Pin Button */}
                    <div 
                        onClick={(e) => handleTogglePin(e, model.id, model.pinned)}
                        className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700",
                            model.pinned && "opacity-100 text-blue-500"
                        )}
                    >
                        {model.pinned ? <MdPushPin size={14} /> : <MdPushPinOutlined size={14} className="text-gray-400" />}
                    </div>

                    {isSelected && <MdCheck className="w-3.5 h-3.5 text-black dark:text-white" />}
                </div>
            </div>
        </button>
      );
  };

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
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {selectedModelLogo ? (
                <img src={selectedModelLogo} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
                <MdSmartToy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
        </div>
        <span className="text-sm font-medium whitespace-nowrap select-none">
          {selectedModel ? selectedModel.name : 'Select Model'}
        </span>
        <MdExpandMore className={cn(
          "w-4 h-4 transition-transform text-gray-400 dark:text-gray-500",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute bottom-full right-0 mb-2 w-72",
            "bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl",
            "border border-gray-200 dark:border-gray-800",
            "animate-in fade-in slide-in-from-bottom-2 duration-150 origin-bottom-right",
            "z-50 overflow-hidden flex flex-col select-none"
          )}
          style={{ maxHeight: '400px' }}
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-[#1E1E1E] z-10">
            <div className="relative">
              <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
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
                  {/* Pinned Section */}
                  {filteredPinned.length > 0 && (
                    <div className="mb-1">
                        <div className="px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-gray-50/50 dark:bg-white/5 sticky top-0 backdrop-blur-sm flex items-center gap-1 select-none">
                            <MdPushPin size={10} /> Pinned
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                            {filteredPinned.map(renderModelItem)}
                        </div>
                    </div>
                  )}

                  {/* Normal Groups */}
                  {Object.entries(filteredGroups).sort().map(([group, groupModels]) => (
                    <div key={group} className="mb-1 last:mb-0">
                      <div className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest bg-gray-50/50 dark:bg-white/5 sticky top-0 backdrop-blur-sm select-none">
                        {group}
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {groupModels.map(renderModelItem)}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}