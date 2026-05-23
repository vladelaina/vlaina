import { shouldPersistSession } from '@/lib/ai/temporaryChat';
import {
  flushPendingSessionJsonSaves,
  hasPendingSessionJsonSave,
  loadSessionJson,
  mergeSessionMessages,
} from '@/lib/storage/chatStorage';
import type { ChatMessage } from '@/lib/ai/types';
import { useUnifiedStore } from '../unified/useUnifiedStore';

function areMessagesEqual(left: ChatMessage[], right: ChatMessage[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function syncSessionMessagesFromDisk(
  sessionId: string,
  flushPendingWrites: boolean,
): Promise<ChatMessage[]> {
  const initialState = useUnifiedStore.getState();
  const initialAI = initialState.data.ai;
  if (!initialAI || !shouldPersistSession(initialAI, sessionId)) {
    return initialAI?.messages[sessionId] || [];
  }

  if (flushPendingWrites) {
    try {
      await flushPendingSessionJsonSaves();
    } catch {
    }
  }

  const persistedMessages = await loadSessionJson(sessionId);
  const latestState = useUnifiedStore.getState();
  const latestAI = latestState.data.ai;
  if (!latestAI) {
    return [];
  }

  const currentMessages = latestAI.messages[sessionId] || [];
  if (!persistedMessages) {
    return currentMessages;
  }

  const hasPendingLocalWrite = hasPendingSessionJsonSave(sessionId);
  const nextMessages = mergeSessionMessages(currentMessages, persistedMessages, {
    preferredSource: hasPendingLocalWrite ? 'incoming' : 'persisted',
  });
  if (areMessagesEqual(nextMessages, currentMessages)) {
    return currentMessages;
  }

  latestState.updateAIData({
    messages: {
      ...latestAI.messages,
      [sessionId]: nextMessages,
    },
  }, true);

  return nextMessages;
}

export async function hydrateSessionMessagesFromDisk(sessionId: string): Promise<ChatMessage[]> {
  return syncSessionMessagesFromDisk(sessionId, true);
}

export async function reloadSessionMessagesFromDisk(sessionId: string): Promise<ChatMessage[]> {
  return syncSessionMessagesFromDisk(sessionId, false);
}
