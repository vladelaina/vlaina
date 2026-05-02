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
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#41a8ea] text-white shadow-sm shadow-[#41a8ea]/25 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' }}
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
                ? 'bg-[#41a8ea] text-white shadow-md shadow-[#41a8ea]/25 hover:scale-105 active:scale-95'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-default'
            )}
            style={canSend ? { boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' } : undefined}
          >
            <Icon name="common.send" size="md" />
          </button>
        )}
      </div>
    </div>
  );
}
