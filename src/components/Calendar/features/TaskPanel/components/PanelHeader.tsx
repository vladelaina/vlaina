import { Search, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelView = 'tasks' | 'progress';

interface PanelHeaderProps {
    panelView: PanelView;
    onViewChange: (view: PanelView) => void;
    showSearch: boolean;
    onToggleSearch: () => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    hideSearchButton?: boolean; // Hide search button when not in tasks view
}

export function PanelHeader({
    panelView,
    onViewChange,
    showSearch,
    onToggleSearch,
    isExpanded = false,
    onToggleExpand,
    hideSearchButton = false,
}: PanelHeaderProps) {
    return (
        <div className="flex-shrink-0 px-3 pt-3 pb-2">
            <div className="flex items-center justify-between gap-2">
                {/* Tab switcher */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
                    <button
                        onClick={() => onViewChange('tasks')}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            panelView === 'tasks'
                                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        Tasks
                    </button>
                    <button
                        onClick={() => onViewChange('progress')}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            panelView === 'progress'
                                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        Progress
                    </button>
                </div>

                {/* Tool buttons */}
                <div className="flex items-center gap-1">
                    {/* Search button - only shown in tasks view */}
                    {!hideSearchButton && (
                        <button
                            onClick={onToggleSearch}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                showSearch
                                    ? "text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800"
                                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            )}
                        >
                            <Search className="size-4" />
                        </button>
                    )}

                    {/* Expand/Collapse button */}
                    {onToggleExpand && (
                        <button
                            onClick={onToggleExpand}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
