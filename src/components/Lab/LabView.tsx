import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';
import { LAB_MODULES, type LabId } from './config';

export function LabView() {
  const [activeLabId, setActiveLabId] = useState<LabId>(LAB_MODULES[0].id);
  const { setAppViewMode } = useUIStore();

  const ActiveComponent = LAB_MODULES.find(m => m.id === activeLabId)?.component || LAB_MODULES[0].component;

  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)] overflow-hidden">
      {/* Top Navigation Bar - Minimalist */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-zinc-900 flex-none h-14">
        <button 
            onClick={() => setAppViewMode('notes')} 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="Exit Lab"
        >
            <Icon name="nav.chevronLeft" size="md" />
        </button>
        
        <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />
        
        <div className="flex items-center gap-1">
            {LAB_MODULES.map((module) => (
                <button
                    key={module.id}
                    onClick={() => setActiveLabId(module.id)}
                    className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        activeLabId === module.id
                            ? "bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                    )}
                >
                    {module.label}
                </button>
            ))}
        </div>
      </div>

      {/* Lab Content Area - Full Width */}
      <div className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-[#090909]">
        <div className="absolute inset-0 overflow-y-auto neko-scrollbar p-8">
            <ActiveComponent />
        </div>
      </div>
    </div>
  );
}