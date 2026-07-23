import { useRef } from 'react';
import type { ChatMessage, ChatSession } from '@/lib/ai/types';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { EMPTY_MESSAGES, EMPTY_SESSIONS } from '../ChatViewState';

interface RetainedChatState {
  currentSessionId: string | null;
  messages: ChatMessage[] | undefined;
  sessions: ChatSession[];
}

export function useChatViewStoreState(active: boolean, warmInactiveContent: boolean) {
  const retainedStateRef = useRef<RetainedChatState | null>(null);
  if (!retainedStateRef.current) {
    const currentSessionId = active || warmInactiveContent
      ? useAIUIStore.getState().currentSessionId
      : null;
    const ai = useUnifiedStore.getState().data.ai;
    retainedStateRef.current = {
      currentSessionId,
      messages: currentSessionId ? ai?.messages?.[currentSessionId] : undefined,
      sessions: active || warmInactiveContent ? ai?.sessions ?? EMPTY_SESSIONS : EMPTY_SESSIONS,
    };
  }

  const liveCurrentSessionId = useAIUIStore((state) => active ? state.currentSessionId : null);
  const liveSessions = useUnifiedStore((state) => (
    active ? state.data.ai?.sessions ?? EMPTY_SESSIONS : EMPTY_SESSIONS
  ));
  const liveMessages = useUnifiedStore((state) => {
    if (!active || !liveCurrentSessionId) {
      return undefined;
    }
    return state.data.ai?.messages?.[liveCurrentSessionId];
  });
  const isSessionActive = useAIUIStore((state) => (
    active && liveCurrentSessionId
      ? state.generatingSessions[liveCurrentSessionId] === true
      : false
  ));

  if (active) {
    retainedStateRef.current = {
      currentSessionId: liveCurrentSessionId,
      messages: liveMessages,
      sessions: liveSessions,
    };
  }

  const retainedState = retainedStateRef.current;
  const currentSessionId = retainedState.currentSessionId;
  const sessions = retainedState.sessions;
  const messages = retainedState.messages ?? EMPTY_MESSAGES;
  const isMessagesLoaded = !currentSessionId
    || !sessions.some((session) => session.id === currentSessionId)
    || retainedState.messages !== undefined;

  return {
    currentSessionId,
    isMessagesLoaded,
    isSessionActive,
    messages,
  };
}
