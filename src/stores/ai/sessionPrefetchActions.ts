import { loadSessionJson } from '@/lib/storage/chatStorage';
import { isTemporarySessionId } from '@/lib/ai/temporaryChat';
import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
import { useUnifiedStore } from '../unified/useUnifiedStore';

interface PendingSessionPrefetch {
  promise: Promise<void>;
  started: boolean;
}

const pendingSessionPrefetches = new Map<string, PendingSessionPrefetch>();
const cancelledSessionPrefetches = new Set<string>();
const explicitSwitchCancelledSessionPrefetches = new Set<string>();
const sessionPrefetchQueue = createAsyncPrefetchQueue(2);

export async function awaitStartedOrCancelQueuedSessionPrefetch(sessionId: string): Promise<boolean> {
  const pendingPrefetch = pendingSessionPrefetches.get(sessionId);
  if (!pendingPrefetch) {
    return false;
  }

  if (!pendingPrefetch.started) {
    explicitSwitchCancelledSessionPrefetches.add(sessionId);
    return false;
  }

  try {
    await pendingPrefetch.promise;
  } catch {
    return false;
  }
  return true;
}

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

      cancelledSessionPrefetches.delete(sessionId);
      const existing = pendingSessionPrefetches.get(sessionId);
      if (existing) {
        await existing.promise;
        return;
      }

      const pendingPrefetch: PendingSessionPrefetch = {
        promise: Promise.resolve(),
        started: false,
      };
      const task = sessionPrefetchQueue.run(async () => {
        pendingPrefetch.started = true;
        if (
          cancelledSessionPrefetches.has(sessionId) ||
          explicitSwitchCancelledSessionPrefetches.has(sessionId)
        ) {
          return;
        }

        const stateBeforeLoad = useUnifiedStore.getState();
        const aiBeforeLoad = stateBeforeLoad.data.ai;
        if (!aiBeforeLoad?.sessions.some((session) => session.id === sessionId) || sessionId in aiBeforeLoad.messages) {
          return;
        }

        const loadedMessages = await loadSessionJson(sessionId);
        if (!loadedMessages) {
          return;
        }
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
      }).catch(() => {
        // Hover prefetch should never surface as a user-visible chat error.
      });
      pendingPrefetch.promise = task;

      pendingSessionPrefetches.set(sessionId, pendingPrefetch);
      try {
        await task;
      } finally {
        pendingSessionPrefetches.delete(sessionId);
        cancelledSessionPrefetches.delete(sessionId);
        explicitSwitchCancelledSessionPrefetches.delete(sessionId);
      }
    },
    cancelSessionPrefetch: (sessionId: string) => {
      const pendingPrefetch = pendingSessionPrefetches.get(sessionId);
      if (!pendingPrefetch || pendingPrefetch.started) {
        return;
      }

      cancelledSessionPrefetches.add(sessionId);
    },
  };
}
