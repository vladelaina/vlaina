import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { ModelSelector } from '../ModelSelector';
import type { RefObject } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatInputActionsProps {
  nativeWebSearchEnabled: boolean;
  onToggleNativeWebSearch: () => void;
  onTriggerFileSelect: () => void;
  isLoading: boolean;
  canSend: boolean;
  hasDraftMessage: boolean;
  onStop: () => void;
  onSend: () => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
}

export function ChatInputActions({
  nativeWebSearchEnabled,
  onToggleNativeWebSearch,
  onTriggerFileSelect,
  isLoading,
  canSend,
  hasDraftMessage,
  onStop,
  onSend,
  composerInputRef,
}: ChatInputActionsProps) {
  return (
    <div className="flex items-center justify-between px-2 pb-2 pl-3">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200',
                iconButtonStyles,
                'hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 active:scale-95'
              )}
            >
              <Icon name="common.add" size="md" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-48 bg-white dark:bg-[#1E1E1E]">
            <DropdownMenuItem onClick={onToggleNativeWebSearch} className="gap-2 cursor-pointer">
              <Icon
                name="file.public"
                size="md"
                className={nativeWebSearchEnabled ? 'text-blue-500' : 'text-gray-500'}
              />
              <span>Web Search</span>
              {nativeWebSearchEnabled && (
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded-full">ON</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onTriggerFileSelect} className="gap-2 cursor-pointer">
              <Icon name="file.attach" size="md" className="text-gray-500" />
              <span>Attach File</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTriggerFileSelect} className="gap-2 cursor-pointer">
              <Icon name="file.image" size="md" className="text-gray-500" />
              <span>Add Image</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {nativeWebSearchEnabled && (
          <button
            onClick={onToggleNativeWebSearch}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all animate-in fade-in zoom-in duration-200',
              'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              'hover:bg-blue-200 dark:hover:bg-blue-900/50'
            )}
          >
            <Icon name="file.public" size="md" />
            <span>Search</span>
            <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 ml-0.5">
              <span className="text-[10px] font-bold">×</span>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector composerInputRef={composerInputRef} />

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
