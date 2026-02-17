import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { hasUserMessage } from '@/lib/ai/temporaryChat';

export function useTemporaryTogglePresentation() {
  const temporaryChatEnabled = useUnifiedStore(
    (state) => !!state.data.ai?.temporaryChatEnabled
  );
  const hasUserMessageInCurrentSession = useUnifiedStore((state) => {
    const aiData = state.data.ai;
    const currentSessionId = aiData?.currentSessionId || null;
    const currentMessages = currentSessionId ? (aiData?.messages?.[currentSessionId] || []) : [];
    return hasUserMessage(currentMessages);
  });

  const showInTitleBar = temporaryChatEnabled && hasUserMessageInCurrentSession;
  const showInChatArea = !hasUserMessageInCurrentSession && !showInTitleBar;

  return {
    temporaryChatEnabled,
    hasUserMessageInCurrentSession,
    showInTitleBar,
    showInChatArea,
    titleBarReadOnly: showInTitleBar
  };
}
