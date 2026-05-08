import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, iconButtonStyles } from '@/lib/utils';

interface ChatInputActionsProps {
  onTriggerFileSelect: () => void;
  isLoading: boolean;
  canSend: boolean;
  canSubmit: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  onStop: () => void;
  onSend: () => void;
}

export function ChatInputActions({
  onTriggerFileSelect,
  isLoading,
  canSend,
  canSubmit,
  webSearchEnabled,
  onToggleWebSearch,
  onStop,
  onSend,
}: ChatInputActionsProps) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const handleTriggerFileSelect = () => {
    setActionsOpen(false);
    onTriggerFileSelect();
  };

  const handleEnableWebSearch = () => {
    setActionsOpen(false);
    if (!webSearchEnabled) {
      onToggleWebSearch();
    }
  };

  return (
    <div className="flex items-center justify-between px-2 pb-2 pl-3">
      <div className="flex items-center gap-2">
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open chat actions"
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200',
                iconButtonStyles,
                'text-[var(--chat-sidebar-text)] hover:bg-black/5 dark:hover:bg-black/5 hover:text-[var(--chat-sidebar-text)] active:scale-95'
              )}
            >
              <Icon name="common.add" size="md" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-52 rounded-xl border-black/10 bg-white p-1.5 text-gray-900 shadow-lg"
          >
            <button
              type="button"
              onClick={handleTriggerFileSelect}
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] transition-colors hover:bg-gray-100"
            >
              <Icon name="common.upload" size="md" className="text-gray-500" />
              <span>Upload file</span>
            </button>
            {!webSearchEnabled && (
              <button
                type="button"
                onClick={handleEnableWebSearch}
                className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] transition-colors hover:bg-gray-100"
              >
                <Icon name="file.public" size="md" className="text-gray-500" />
                <span>Web search</span>
              </button>
            )}
          </PopoverContent>
        </Popover>
        {webSearchEnabled && (
          <button
            type="button"
            aria-pressed="true"
            aria-label="Disable web search"
            title="Web search on"
            onClick={onToggleWebSearch}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#e7f3ff] text-[#1677c8] transition-all duration-200 hover:bg-[#d9ecff] active:scale-95"
          >
            <Icon name="file.public" size="md" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLoading ? (
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
            disabled={!canSubmit}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200',
              canSubmit
                ? 'bg-[#41a8ea] text-white shadow-md shadow-[#41a8ea]/25 hover:scale-105 active:scale-95'
                : canSend
                  ? 'bg-[#41a8ea] text-white opacity-60 shadow-sm shadow-[#41a8ea]/15 cursor-default'
                : 'bg-[#e7f3ff] text-[#9acff3] cursor-default'
            )}
            style={canSubmit ? { boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' } : undefined}
          >
            <Icon name="common.send" size="md" />
          </button>
        )}
      </div>
    </div>
  );
}
