import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { Provider } from '@/lib/ai/types';

interface ProviderSidebarProps {
  allProviders: Provider[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddCustom: () => void;
}

export function ProviderSidebar({
  allProviders,
  selectedId,
  onSelect,
  onAddCustom
}: ProviderSidebarProps) {
  return (
      <aside className="w-[240px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.16em]">Channels</p>
          </div>
          <button
            onClick={onAddCustom}
            title="Add Channel"
            className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            <Icon name="common.add" className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 scrollbar-none">
          {allProviders.length > 0 ? (
            allProviders.map((provider) => {
              const isSelected = selectedId === provider.id;
              const icon = provider.icon || 'cube';

              return (
                <button
                  key={provider.id}
                  onClick={() => onSelect(provider.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-200",
                    isSelected
                      ? "bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-white/5"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center overflow-hidden flex-shrink-0",
                    isSelected ? "opacity-100" : "opacity-85"
                  )}>
                    <AppIcon icon={icon} size="sm" className="w-full h-full object-contain" />
                  </div>
                  <span className="flex-1 text-left truncate text-[13px] font-medium">{provider.name}</span>
                </button>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              No channels
            </div>
          )}
        </div>
      </aside>
  );
}
