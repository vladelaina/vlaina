import { useState, useRef, useEffect } from 'react'
import { MdExpandMore, MdSearch, MdSmartToy } from 'react-icons/md'
import { useAIStore } from '@/stores/useAIStore'
import { groupModels } from '@/lib/ai/utils'
import { cn } from '@/lib/utils'
import { getModelLogoById } from '@/components/Settings/tabs/ai/modelIcons'

export function ModelSelector() {
  const { models, selectedModelId, selectModel, getSelectedModel } = useAIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModel = getSelectedModel()
  const enabledModels = models.filter(m => m.enabled)
  const groupedModels = groupModels(enabledModels)

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

  const selectedModelLogo = selectedModel ? getModelLogoById(selectedModel.id) : undefined;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "text-sm font-medium",
          "text-gray-700 dark:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
          "transition-colors"
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {selectedModelLogo ? (
                <img src={selectedModelLogo} alt="" className="w-full h-full object-contain" />
            ) : (
                <MdSmartToy className="w-5 h-5 text-gray-500" />
            )}
        </div>
        <span className="max-w-[120px] truncate font-medium">
          {selectedModel ? selectedModel.name : 'Select Model'}
        </span>
        <MdExpandMore className={cn(
          "w-4 h-4 transition-transform text-gray-400",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute bottom-full left-0 mb-2 w-80",
            "bg-white dark:bg-gray-800 rounded-xl shadow-2xl",
            "border border-gray-200 dark:border-gray-700",
            "animate-in fade-in slide-in-from-bottom-2 duration-150",
            "z-50"
          )}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-lg",
                  "bg-gray-50 dark:bg-gray-900",
                  "border border-gray-200 dark:border-gray-700",
                  "text-sm text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500"
                )}
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No models found' : 'No models configured'}
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
                    window.dispatchEvent(event)
                  }}
                  className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Configure models
                </button>
              </div>
            ) : (
              Object.entries(filteredGroups).map(([group, groupModels]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {group}
                  </div>
                  {groupModels.map((model) => {
                    const logo = getModelLogoById(model.id);
                    return (
                        <button
                          key={model.id}
                          onClick={() => handleSelectModel(model.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                            "text-left transition-colors",
                            selectedModelId === model.id
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          )}
                        >
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            {logo ? (
                                <img src={logo} alt="" className="w-full h-full object-contain" />
                            ) : (
                                <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-[10px] font-bold text-gray-500">
                                    {model.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{model.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{model.id}</div>
                          </div>
                        </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
