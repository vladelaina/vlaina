import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MdChevronLeft } from 'react-icons/md';
import { useUIStore } from '@/stores/uiSlice';
import { LAB_MODULES, type LabId } from './config';

export function LabView() {
  const [activeLabId, setActiveLabId] = useState<LabId>(LAB_MODULES[0].id);
  const { setAppViewMode } = useUIStore();

  const ActiveComponent = LAB_MODULES.find(m => m.id === activeLabId)?.component || LAB_MODULES[0].component;

  return (
    <div className="h-full flex bg-[var(--neko-bg-primary)] overflow-hidden">
      {/* Lab Sidebar - Dynamic Generation */}
      <div className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <button 
                onClick={() => setAppViewMode('notes')} // Go back to default
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                title="Exit Lab"
            >
                <MdChevronLeft className="text-gray-500" size={20} />
            </button>
            <span className="font-bold text-sm text-purple-600 tracking-tight">DESIGN LAB</span>
        </div>
        
        <div className="p-2 space-y-1 overflow-y-auto">
            {LAB_MODULES.map((module) => {
                const Icon = module.icon;
                const isActive = activeLabId === module.id;
                return (
                    <button
                        key={module.id}
                        onClick={() => setActiveLabId(module.id)}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all duration-200 text-sm font-medium",
                            isActive
                                ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-100 dark:ring-purple-500/20" 
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                        )}
                    >
                        <Icon size={18} className={isActive ? "text-purple-500" : "text-gray-400 group-hover:text-gray-500"} />
                        <div className="flex flex-col">
                            <span>{module.label}</span>
                        </div>
                    </button>
                );
            })}
        </div>
      </div>

      {/* Lab Content Area - Dynamic Rendering */}
      <div className="flex-1 overflow-hidden relative bg-gray-50/50 dark:bg-black/20">
        <div className="absolute inset-0 overflow-y-auto neko-scrollbar">
            <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
