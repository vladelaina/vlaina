import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';

export function runOpenNewChatShortcut() {
  aiActions.openNewChat();
}

export function runTemporaryChatWelcomeShortcut() {
  const state = useUnifiedStore.getState();
  const aiState = state.data.ai;
  const temporaryEnabled = !!aiState?.temporaryChatEnabled;
  const currentSessionId = aiState?.currentSessionId || null;
  const currentMessages = currentSessionId ? (aiState?.messages?.[currentSessionId] || []) : [];
  const isCurrentTemporaryChatEmpty = temporaryEnabled && currentMessages.length === 0;

  if (!temporaryEnabled) {
    aiActions.toggleTemporaryChat(true);
    return;
  }

  if (isCurrentTemporaryChatEmpty) {
    aiActions.openNewChat();
    return;
  }

  aiActions.createSession('New Chat');
}
