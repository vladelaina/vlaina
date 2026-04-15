import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { hasUserMessage } from '@/lib/ai/temporaryChat';

export function useTemporaryTogglePresentation() {
  const temporaryChatEnabled = useAIUIStore((state) => state.temporaryChatEnabled);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const hasUserMessageInCurrentSession = useUnifiedStore((state) => {
    const aiData = state.data.ai;
    const currentMessages = currentSessionId ? (aiData?.messages?.[currentSessionId] || []) : [];
    return hasUserMessage(currentMessages);
  });

  const showInTitleBar = temporaryChatEnabled && hasUserMessageInCurrentSession;
  const showInChatArea = !hasUserMessageInCurrentSession && !showInTitleBar;

  return {
    temporaryChatEnabled,
    hasUserMessageInCurrentSession,
    showInTitleBar,
    showInChatArea
  };
}
