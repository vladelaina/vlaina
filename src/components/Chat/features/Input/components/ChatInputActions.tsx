import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';

interface ChatInputActionsProps {
  onTriggerFileSelect: () => void;
  isLoading: boolean;
  canSend: boolean;
  hasDraftMessage: boolean;
  onStop: () => void;
  onSend: () => void;
}

export function ChatInputActions({
  onTriggerFileSelect,
  isLoading,
  canSend,
  hasDraftMessage,
  onStop,
  onSend,
}: ChatInputActionsProps) {
  return (
    <div className="flex items-center justify-between px-2 pb-2 pl-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onTriggerFileSelect}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200',
            iconButtonStyles,
            'hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 active:scale-95'
          )}
        >
          <Icon name="common.add" size="md" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {isLoading && !hasDraftMessage ? (
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-white text-black dark:text-black shadow-sm hover:scale-105 active:scale-95"
          >
            <Icon name="media.stop" size="md" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200',
              canSend
                ? 'bg-black text-white shadow-md hover:scale-105 active:scale-95'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-default'
            )}
          >
            <Icon name="common.send" size="md" />
          </button>
        )}
      </div>
    </div>
  );
}
