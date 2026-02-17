import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAIStore } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { hasUserMessage } from '@/lib/ai/temporaryChat';

interface TemporaryChatToggleProps {
  readOnly?: boolean;
}

export function TemporaryChatToggle({ readOnly = false }: TemporaryChatToggleProps) {
  const { temporaryChatEnabled, toggleTemporaryChat, currentSessionId, messages } = useAIStore();
  const currentMessages = currentSessionId ? (messages[currentSessionId] || []) : [];
  const hasUserMessageInCurrentSession = hasUserMessage(currentMessages);
  const canDisableTemporaryChat = !temporaryChatEnabled || !hasUserMessageInCurrentSession;

  const handleClick = () => {
    if (readOnly) {
      return;
    }

    if (!temporaryChatEnabled) {
      toggleTemporaryChat(true);
      return;
    }

    if (canDisableTemporaryChat) {
      toggleTemporaryChat(false);
      return;
    }
  };

  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={temporaryChatEnabled ? 'Temporary Chat is On' : 'Enable Temporary Chat'}
          onClick={handleClick}
          disabled={readOnly}
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-md transition-colors',
            temporaryChatEnabled
              ? 'bg-[#f0f4ff] dark:bg-white/15 text-[#1e4fd6] dark:text-white'
              : 'hover:bg-[#f5f5f5] dark:hover:bg-white/10',
            readOnly && 'cursor-default pointer-events-none opacity-95',
            iconButtonStyles
          )}
        >
          <Icon name="chat.temporary" size="md" />
          {temporaryChatEnabled && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Icon name="common.check" size={10} className="translate-y-[0.5px]" />
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={2}>
        <span className="text-xs">
          {!temporaryChatEnabled
            ? 'Enable Temporary Chat'
            : readOnly
              ? 'Temporary Chat: On'
            : canDisableTemporaryChat
              ? 'Temporary Chat: On (Click to Disable)'
              : 'Temporary Chat: Locked for Current Conversation'}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
