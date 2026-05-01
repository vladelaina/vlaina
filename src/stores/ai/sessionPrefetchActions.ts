import { loadSessionJson } from '@/lib/storage/chatStorage';
import { isTemporarySessionId } from '@/lib/ai/temporaryChat';
import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
import { useUnifiedStore } from '../unified/useUnifiedStore';

const pendingSessionPrefetches = new Map<string, Promise<void>>();
const sessionPrefetchQueue = createAsyncPrefetchQueue(2);

export function createSessionPrefetchActions() {
  return {
    prefetchSession: async (sessionId: string) => {
      if (isTemporarySessionId(sessionId)) {
        return;
      }

      const state = useUnifiedStore.getState();
      const ai = state.data.ai;
      if (!ai?.sessions.some((session) => session.id === sessionId)) {
        return;
      }
      if (sessionId in ai.messages) {
        return;
      }

      const existing = pendingSessionPrefetches.get(sessionId);
      if (existing) {
        await existing;
        return;
      }

      const task = sessionPrefetchQueue.run(async () => {
        const loadedMessages = await loadSessionJson(sessionId);
        const freshState = useUnifiedStore.getState();
        const ai = freshState.data.ai;
        if (!ai?.sessions.some((session) => session.id === sessionId) || sessionId in ai.messages) {
          return;
        }

        freshState.updateAIData({
          messages: {
            ...ai.messages,
            [sessionId]: loadedMessages || [],
          },
        }, true);
      });

      pendingSessionPrefetches.set(sessionId, task);
      try {
        await task;
      } catch {
        // Hover prefetch should never surface as a user-visible chat error.
      } finally {
        pendingSessionPrefetches.delete(sessionId);
      }
    },
  };
}
