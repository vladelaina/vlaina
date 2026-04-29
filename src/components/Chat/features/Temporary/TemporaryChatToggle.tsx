import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { hasUserMessage } from '@/lib/ai/temporaryChat';
import { useAutoTitle } from '@/hooks/useAutoTitle';

interface TemporaryChatToggleProps {
  readOnly?: boolean;
  mode?: 'toggle' | 'promote';
}

const EMPTY_MESSAGES: never[] = [];

export function TemporaryChatToggle({ readOnly = false, mode = 'toggle' }: TemporaryChatToggleProps) {
  const temporaryChatEnabled = useAIUIStore((state) => state.temporaryChatEnabled);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const currentMessages = useUnifiedStore((state) => {
    if (!currentSessionId) {
      return EMPTY_MESSAGES;
    }

    return state.data.ai?.messages?.[currentSessionId] || EMPTY_MESSAGES;
  });
  const currentSessionModelId = useUnifiedStore((state) => {
    if (!currentSessionId) {
      return undefined;
    }

    return (state.data.ai?.sessions || []).find((session) => session.id === currentSessionId)?.modelId;
  });
  const models = useUnifiedStore((state) => state.data.ai?.models || []);
  const providers = useUnifiedStore((state) => state.data.ai?.providers || []);
  const selectedModelId = useUnifiedStore((state) => state.data.ai?.selectedModelId || null);
  const isCurrentSessionGenerating = useAIUIStore((state) =>
    currentSessionId ? !!state.generatingSessions[currentSessionId] : false
  );
  const { generateAutoTitle } = useAutoTitle();
  const selectedModel = selectedModelId
    ? (() => {
        const model = models.find((item) => item.id === selectedModelId);
        if (!model) {
          return undefined;
        }
        const provider = providers.find((item) => item.id === model.providerId);
        return provider?.enabled === false ? undefined : model;
      })()
    : undefined;
  const hasUserMessageInCurrentSession = hasUserMessage(currentMessages);
  const canDisableTemporaryChat = !temporaryChatEnabled || !hasUserMessageInCurrentSession;
  const isPromoteMode = mode === 'promote';
  const isDisabled = readOnly || (isPromoteMode && isCurrentSessionGenerating);

  const handleClick = () => {
    if (isDisabled) {
      return;
    }

    if (isPromoteMode) {
      const promotedSessionId = aiActions.promoteTemporarySession();
      if (!promotedSessionId) return;

      const modelForTitle = (currentSessionModelId
        ? models.find((model) => model.id === currentSessionModelId)
        : undefined) || selectedModel;

      if (modelForTitle) {
        void generateAutoTitle(promotedSessionId, modelForTitle.providerId, modelForTitle.id);
      }
      return;
    }

    if (!temporaryChatEnabled) {
      aiActions.toggleTemporaryChat(true);
      return;
    }

    if (canDisableTemporaryChat) {
      aiActions.toggleTemporaryChat(false);
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
