import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface HealthStatus {
    status: 'loading' | 'success' | 'error';
    latency?: number;
    error?: string;
}

export function formatBenchmarkLatency(latency?: number) {
  if (typeof latency !== 'number' || Number.isNaN(latency)) {
    return null;
  }

  const seconds = latency / 1000;
  const formatted = seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1);

  return `${formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}s`;
}

interface ModelListItemProps {
  modelId: string;
  isAdded: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  health?: HealthStatus;
}

export function ModelListItem({ modelId, isAdded, onAdd, onRemove, health }: ModelListItemProps) {
  const showAddAction = !isAdded && !!onAdd;

  return (
    <div className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors duration-150",
        showAddAction
            ? "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            : "bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800"
    )}>
        <div className="flex-1 min-w-0">
            <div className={cn(
                "text-sm truncate",
                showAddAction
                    ? "font-medium text-gray-800 dark:text-gray-100"
                    : "font-medium text-gray-600 dark:text-gray-400"
            )}>
                {modelId}
            </div>
        </div>

        {health && (
            <div className="flex items-center gap-1.5 mr-2">
                {health.status === 'loading' && (
                    <div className="size-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                {health.status === 'success' && (
                    <span className="text-[10px] font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                        {formatBenchmarkLatency(health.latency)}
                    </span>
                )}
                {health.status === 'error' && (
                    <div className="text-red-500 cursor-help" title={health.error}>
                        <Icon name="common.error" size="sm" />
                    </div>
                )}
            </div>
        )}

        {isAdded ? (
            onRemove ? (
                <button 
                    onClick={onRemove} 
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" 
                    title="Remove"
                >
                    <Icon name="common.delete" className="w-4 h-4" />
                </button>
            ) : (
                <div className="text-green-600 dark:text-green-500 px-1.5 flex items-center gap-1.5">
                    <Icon name="common.check" className="w-4 h-4" />
                    <span className="text-[11px] font-medium">Added</span>
                </div>
            )
        ) : showAddAction ? (
            <button 
                onClick={onAdd} 
                className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Add"
            >
                <Icon name="common.add" className="w-4 h-4" />
            </button>
        ) : null}
    </div>
  );
}
