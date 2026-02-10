import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getModelLogoById } from '../modelIcons';

export interface HealthStatus {
    status: 'loading' | 'success' | 'error';
    latency?: number;
    error?: string;
}

interface ModelListItemProps {
  modelId: string;
  isAdded: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  health?: HealthStatus;
}

export function ModelListItem({ modelId, isAdded, onAdd, onRemove, health }: ModelListItemProps) {
  const modelIcon = getModelLogoById(modelId);

  return (
    <div className={cn(
        "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 group relative",
        isAdded && onAdd
            ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
    )}>
        {/* Model Icon - Changed to rounded-full */}
        <div className="w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-800">
            {modelIcon ? (
                <img src={modelIcon} className="w-full h-full object-contain rounded-full" alt="" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 rounded-full">
                    {modelId.charAt(0).toUpperCase()}
                </div>
            )}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {modelId}
            </div>
        </div>

        {/* Health Status Indicator */}
        {health && (
            <div className="flex items-center gap-1.5 mr-2">
                {health.status === 'loading' && (
                    <div className="size-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                {health.status === 'success' && (
                    <span className="text-[10px] font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                        {health.latency}ms
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
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" 
                    title="Remove"
                >
                    <Icon name="common.delete" className="w-4 h-4" />
                </button>
            ) : (
                <div className="text-green-600 dark:text-green-500 px-2">
                    <Icon name="common.check" className="w-4 h-4" />
                </div>
            )
        ) : (
            <button 
                onClick={onAdd} 
                className="p-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Add"
            >
                <Icon name="common.add" className="w-4 h-4" />
            </button>
        )}
    </div>
  );
}