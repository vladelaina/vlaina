import type { useUnifiedStore } from '../unified/useUnifiedStore';

export function resolveRestoredChatSessionId(
  aiData: ReturnType<typeof useUnifiedStore.getState>['data']['ai'],
  lastChatSessionId: string | null | undefined,
): string | null {
  const sessions = aiData?.sessions || [];
  const hasSession = (sessionId: string | null | undefined) =>
    Boolean(sessionId && sessions.some((session) => session.id === sessionId));

  if (hasSession(lastChatSessionId)) {
    return lastChatSessionId || null;
  }

  return hasSession(aiData?.currentSessionId) ? aiData?.currentSessionId ?? null : null;
}
