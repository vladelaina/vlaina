import { MdAdd, MdCheck, MdDelete } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { getModelLogoById } from '../modelIcons';

interface ModelListItemProps {
  modelId: string;
  isAdded: boolean;
  defaultIcon: string;
  onAdd?: () => void;
  onRemove?: () => void;
}

export function ModelListItem({ modelId, isAdded, onAdd, onRemove, defaultIcon }: ModelListItemProps) {
  const modelIcon = getModelLogoById(modelId) || defaultIcon;
  
  return (
    <div className={cn(
        "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 group",
        isAdded && onAdd
            ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
    )}>
        <div className="w-6 h-6 rounded-md bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-800">
            <img src={modelIcon} className="w-full h-full object-contain" alt="" />
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={modelId}>
                {modelId}
            </div>
        </div>

        {isAdded ? (
            onRemove ? (
                <button 
                    onClick={onRemove} 
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" 
                    title="Remove"
                >
                    <MdDelete className="w-4 h-4" />
                </button>
            ) : (
                <div className="text-green-600 dark:text-green-500 px-2">
                    <MdCheck className="w-4 h-4" />
                </div>
            )
        ) : (
            <button 
                onClick={onAdd} 
                className="p-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Add"
            >
                <MdAdd className="w-4 h-4" />
            </button>
        )}
    </div>
  );
}
