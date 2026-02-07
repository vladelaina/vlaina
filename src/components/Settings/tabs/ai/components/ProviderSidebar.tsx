import { MdAdd } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { Provider } from '@/lib/ai/types';
import { ProviderConfig } from '../constants';

interface ProviderSidebarProps {
  allProviders: Provider[];
  supportedConfigs: ProviderConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddCustom: () => void;
}

export function ProviderSidebar({
  allProviders,
  supportedConfigs,
  selectedId,
  onSelect,
  onAddCustom
}: ProviderSidebarProps) {
  // No search, just list
  
  return (
      <div className="w-[200px] flex-shrink-0 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1C1C1C] flex flex-col">
        {/* Header with Add Button only */}
        <div className="p-3 flex items-center justify-between">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Channels</span>
           <button
            onClick={onAddCustom}
            title="Add New Provider"
            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
          >
            <MdAdd className="w-4 h-4" />
          </button>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 scrollbar-none">
          {allProviders.length > 0 ? (
            allProviders.map((provider) => {
              const isSelected = selectedId === provider.id;
              const icon = provider.icon || supportedConfigs[0]?.icon;

              return (
                <button
                  key={provider.id}
                  onClick={() => onSelect(provider.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    isSelected
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-white/5"
                  )}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    <AppIcon icon={icon} size={16} className="w-full h-full object-contain" />
                  </div>
                  <span className="flex-1 text-left truncate text-xs">{provider.name}</span>
                </button>
              );
            })
          ) : (
             <div className="text-center py-8 text-xs text-gray-400">
                No channels
             </div>
          )}
        </div>
      </div>
  );
}
