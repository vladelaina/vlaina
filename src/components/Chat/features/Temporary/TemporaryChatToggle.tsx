import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { hasUserMessage } from '@/lib/ai/temporaryChat';
import { useAutoTitle } from '@/hooks/useAutoTitle';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';

interface TemporaryChatToggleProps {
  readOnly?: boolean;
  mode?: 'toggle' | 'promote';
}

const EMPTY_MESSAGES: never[] = [];

export function TemporaryChatToggle({ readOnly = false, mode = 'toggle' }: TemporaryChatToggleProps) {
  const { t } = useI18n();
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
  const isDisabled = readOnly;
  const toggleTooltipLabel = temporaryChatEnabled
    ? t('chat.disableTemporaryChat')
    : t('chat.enableTemporaryChat');

  const handleClick = () => {
    if (isDisabled) {
      return;
    }

    if (isPromoteMode) {
      void aiActions.promoteTemporarySession().then((promotedSessionId) => {
        if (!promotedSessionId) return;

        const modelForTitle = (currentSessionModelId
          ? models.find((model) => model.id === currentSessionModelId)
          : undefined) || selectedModel;

        if (modelForTitle) {
          void generateAutoTitle(promotedSessionId, modelForTitle.providerId, modelForTitle.id);
        }
      }).catch(() => {});
      return;
    }

    if (!temporaryChatEnabled) {
      aiActions.toggleTemporaryChat(true);
      return;
    }

    if (canDisableTemporaryChat) {
      aiActions.openNewChat();
      return;
    }
  };

  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={isPromoteMode
            ? t('chat.saveAsRegular')
            : (temporaryChatEnabled ? 'Temporary Chat is On' : 'Enable Temporary Chat')}
          onClick={handleClick}
          disabled={isDisabled}
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-md transition-colors',
            iconButtonStyles,
            !isPromoteMode && cn(chatComposerPillSurfaceClass, 'rounded-full'),
            isPromoteMode
              ? 'bg-transparent text-[var(--vlaina-accent)] hover:bg-transparent hover:text-[var(--vlaina-accent)]'
              :
            temporaryChatEnabled
              ? 'text-[var(--vlaina-accent)] hover:text-[var(--vlaina-accent)]'
              : 'text-[var(--vlaina-sidebar-chat-text)] hover:bg-transparent hover:text-[var(--vlaina-accent)] dark:hover:bg-transparent',
            isDisabled && 'cursor-default pointer-events-none opacity-[var(--vlaina-opacity-95)]'
          )}
        >
          <Icon
            name={isPromoteMode ? 'chat.temporary.on' : (temporaryChatEnabled ? 'chat.temporary.on' : 'chat.temporary.off')}
            size="md"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        showArrow={false}
        className={cn(
          "flex rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]",
          isPromoteMode ? 'items-center gap-1.5' : 'flex-col items-center gap-1.5',
          chatComposerPillSurfaceClass
        )}
      >
        {isPromoteMode ? (
          <span>{t('chat.saveAsRegular')}</span>
        ) : (
          <>
            <span>{toggleTooltipLabel}</span>
            <ShortcutKeys
              keys={['Ctrl', 'Shift', 'J']}
              keyClassName="rounded-md bg-[var(--vlaina-sidebar-chat-row-hover)] text-[var(--vlaina-sidebar-chat-text)]"
            />
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
