import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { useAIStore } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { hasUserMessage, buildTitleSourceFromMessages } from '@/lib/ai/temporaryChat';
import { useAutoTitle } from '@/hooks/useAutoTitle';

interface TemporaryChatToggleProps {
  readOnly?: boolean;
  mode?: 'toggle' | 'promote';
}

export function TemporaryChatToggle({ readOnly = false, mode = 'toggle' }: TemporaryChatToggleProps) {
  const {
    temporaryChatEnabled,
    toggleTemporaryChat,
    promoteTemporarySession,
    currentSessionId,
    messages,
    sessions,
    getModel,
    selectedModel,
    isSessionLoading
  } = useAIStore();
  const { generateAutoTitle } = useAutoTitle();
  const currentMessages = currentSessionId ? (messages[currentSessionId] || []) : [];
  const hasUserMessageInCurrentSession = hasUserMessage(currentMessages);
  const canDisableTemporaryChat = !temporaryChatEnabled || !hasUserMessageInCurrentSession;
  const isPromoteMode = mode === 'promote';
  const isCurrentSessionGenerating = currentSessionId ? isSessionLoading(currentSessionId) : false;
  const isDisabled = readOnly || (isPromoteMode && isCurrentSessionGenerating);

  const handleClick = () => {
    if (isDisabled) {
      return;
    }

    if (isPromoteMode) {
      const promotedSessionId = promoteTemporarySession();
      if (!promotedSessionId) return;

      const sessionModelId = currentSessionId
        ? sessions.find((session) => session.id === currentSessionId)?.modelId
        : undefined;
      const modelForTitle = (sessionModelId ? getModel(sessionModelId) : undefined) || selectedModel;

      if (modelForTitle) {
        const titleSource = buildTitleSourceFromMessages(currentMessages);
        void generateAutoTitle(
          promotedSessionId,
          titleSource,
          modelForTitle.providerId,
          modelForTitle.id
        );
      }
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
          aria-label={isPromoteMode
            ? 'Save temporary chat as regular chat'
            : (temporaryChatEnabled ? 'Temporary Chat is On' : 'Enable Temporary Chat')}
          onClick={handleClick}
          disabled={isDisabled}
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-md transition-colors',
            isPromoteMode
              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-500/30'
              :
            temporaryChatEnabled
              ? 'bg-[#f0f4ff] dark:bg-white/15 text-[#1e4fd6] dark:text-white'
              : 'hover:bg-[#f5f5f5] dark:hover:bg-white/10',
            isDisabled && 'cursor-default pointer-events-none opacity-95',
            iconButtonStyles
          )}
        >
          <Icon
            name={isPromoteMode ? 'chat.temporary.on' : (temporaryChatEnabled ? 'chat.temporary.on' : 'chat.temporary.off')}
            size="md"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={2} className="flex items-center gap-1.5 text-xs">
        {isPromoteMode ? (
          <span>Save as regular chat</span>
        ) : (
          <ShortcutKeys keys={['Ctrl', 'Shift', 'J']} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}
