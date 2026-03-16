import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';
import { LAB_MODULES, type LabId } from './config';

export function LabView() {
  const [activeLabId, setActiveLabId] = useState<LabId | null>(LAB_MODULES[0]?.id ?? null);
  const { setAppViewMode } = useUIStore();

  const activeModule = LAB_MODULES.find((m) => m.id === activeLabId) ?? LAB_MODULES[0] ?? null;
  const ActiveComponent = activeModule?.component ?? null;

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
            {ActiveComponent ? (
              <ActiveComponent />
            ) : (
              <div className="flex min-h-full items-center justify-center">
                <div className="rounded-3xl border border-zinc-200/80 bg-white px-8 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-zinc-900">
                  <div className="text-[15px] font-semibold text-zinc-950 dark:text-zinc-100">No Lab Modules</div>
                  <div className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">The lab has been cleared.</div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
