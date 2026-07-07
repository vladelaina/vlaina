import { actions as providerActions } from '@/stores/ai/providerActions';
import { createChatActions } from '@/stores/ai/chatActions';
import { createAIChatSession, useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useUIStore } from '@/stores/uiSlice';
import { saveSessionJson } from '@/lib/storage/chatStorage';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import type { ChatMessage, MessageVersion } from '@/lib/ai/types';
import {
  enqueueChatE2EMockResponse,
  getChatE2EMockPendingRequestIds,
  getChatE2EMockRequests,
  installChatE2EMock,
  resetChatE2EMock,
  resolveChatE2EMockPendingRequest,
} from './chatE2EMock';
import type { E2EBridge } from './syncE2EBridgeTypes';

type ChatBridgeActions = Pick<
  E2EBridge,
  | 'prepareChatWebSearchE2E'
  | 'setChatWebSearchEnabled'
  | 'enqueueChatMockResponse'
  | 'getChatMockRequests'
  | 'getChatMockPendingRequestIds'
  | 'resolveChatMockPendingRequest'
  | 'createChatFixture'
  | 'switchChatSession'
  | 'getChatState'
>;

function normalizeE2EMessageVersions(
  message: {
    role: ChatMessage['role'];
    content: string;
    versions?: Array<{
      content: string;
      kind?: MessageVersion['kind'];
      createdAt?: number;
    }>;
    currentVersionIndex?: number;
  },
  fallbackCreatedAt: number,
): { versions: MessageVersion[]; currentVersionIndex: number; content: string } | null {
  if (!message.versions?.length && typeof message.currentVersionIndex !== 'number') {
    return null;
  }

  const sourceVersions = message.versions?.length
    ? message.versions
    : [{ content: message.content, kind: 'original' as const, createdAt: fallbackCreatedAt }];
  const versions = sourceVersions.map((version, index): MessageVersion => {
    const kind = version.kind ?? (
      index === 0
        ? 'original'
        : message.role === 'assistant'
          ? 'regeneration'
          : message.role === 'user'
            ? 'edit'
            : 'original'
    );
    return {
      content: version.content,
      createdAt: version.createdAt ?? fallbackCreatedAt + index,
      kind,
      subsequentMessages: [],
    };
  });
  const requestedIndex = Number.isInteger(message.currentVersionIndex)
    ? message.currentVersionIndex!
    : 0;
  const currentVersionIndex = Math.min(Math.max(requestedIndex, 0), versions.length - 1);
  return {
    versions,
    currentVersionIndex,
    content: versions[currentVersionIndex]?.content ?? message.content,
  };
}

export function createSyncE2EChatActions(): ChatBridgeActions {
  return {
    prepareChatWebSearchE2E: async () => {
      installChatE2EMock();
      resetChatE2EMock();
      useUIStore.getState().setAppViewMode('chat');
      useUIStore.getState().setLanguagePreference('en');
      providerActions.setWebSearchEnabled(false);
      providerActions.openNewChat();

      const apiModelId = 'e2e-web-search-model';
      const providerId = providerActions.addProvider({
        name: 'E2E web search channel',
        type: 'newapi',
        endpointType: 'openai',
        endpointTypeCheckedAt: Date.now(),
        apiHost: 'https://example.invalid/v1',
        apiKey: 'sk-e2e',
        enabled: true,
      });
      const modelId = `${providerId}::${apiModelId}`;
      providerActions.addModel({
        id: modelId,
        apiModelId,
        name: 'E2E Web Search Model',
        providerId,
        enabled: true,
      });
      providerActions.selectModel(modelId);
      await flushPendingSave();
      return { providerId, modelId };
    },
    setChatWebSearchEnabled: async (enabled) => {
      providerActions.setWebSearchEnabled(enabled);
      await flushPendingSave();
    },
    enqueueChatMockResponse: async (response) => {
      enqueueChatE2EMockResponse(response);
    },
    getChatMockRequests: () => getChatE2EMockRequests(),
    getChatMockPendingRequestIds: () => getChatE2EMockPendingRequestIds(),
    resolveChatMockPendingRequest: async (requestId, response) => {
      return resolveChatE2EMockPendingRequest(requestId, response);
    },
    createChatFixture: async (input) => {
      const chatActions = createChatActions();
      const sessionIds: string[] = [];

      for (const session of input.sessions) {
        const sessionId = createAIChatSession(session.title);
        sessionIds.push(sessionId);

        for (const message of session.messages) {
          const messageId = chatActions.addMessage(
            {
              id: message.id,
              role: message.role,
              content: message.content,
              imageSources: message.imageSources,
              apiTranscript: message.apiTranscript,
              modelId: message.modelId ?? '',
            },
            sessionId,
            {
              persistUnified: false,
              touchSession: true,
            },
          );
          if (!messageId) {
            continue;
          }

          const normalizedVersions = normalizeE2EMessageVersions(message, Date.now());
          if (!normalizedVersions) {
            continue;
          }

          const state = useUnifiedStore.getState();
          const ai = state.data.ai;
          const sessionMessages = ai?.messages[sessionId] ?? [];
          state.updateAIData({
            messages: {
              ...(ai?.messages ?? {}),
              [sessionId]: sessionMessages.map((existingMessage) =>
                existingMessage.id === messageId
                  ? {
                      ...existingMessage,
                      content: normalizedVersions.content,
                      versions: normalizedVersions.versions,
                      currentVersionIndex: normalizedVersions.currentVersionIndex,
                    }
                  : existingMessage
              ),
            },
          }, true);
        }
      }

      const activeSessionId = sessionIds[input.activeSessionIndex ?? 0] ?? sessionIds[0] ?? null;
      if (activeSessionId) {
        await chatActions.switchSession(activeSessionId);
        const state = useUnifiedStore.getState();
        state.updateAIData({ currentSessionId: activeSessionId });
        useAIUIStore.getState().setChatSelection({
          currentSessionId: activeSessionId,
          temporaryChatEnabled: false,
        });
      }

      const ai = useUnifiedStore.getState().data.ai;
      await Promise.all(sessionIds.map((sessionId) => saveSessionJson(sessionId, ai?.messages[sessionId] ?? [])));
      const unloadedSessionIds = sessionIds.filter((sessionId, index) => {
        if (sessionId === activeSessionId) {
          return false;
        }
        return input.sessions[index]?.preloadMessages === false;
      });
      if (unloadedSessionIds.length > 0) {
        const latestAI = useUnifiedStore.getState().data.ai;
        const nextMessages = { ...(latestAI?.messages ?? {}) };
        unloadedSessionIds.forEach((sessionId) => {
          delete nextMessages[sessionId];
        });
        useUnifiedStore.getState().updateAIData({ messages: nextMessages }, true);
      }
      await flushPendingSave();
      return { sessionIds, activeSessionId };
    },
    switchChatSession: async (id) => {
      const chatActions = createChatActions();
      await chatActions.switchSession(id);
      useUnifiedStore.getState().updateAIData({ currentSessionId: id });
      useAIUIStore.getState().setChatSelection({
        currentSessionId: id,
        temporaryChatEnabled: false,
      });
      await flushPendingSave();
    },
    getChatState: () => {
      const ui = useAIUIStore.getState();
      const ai = useUnifiedStore.getState().data.ai;
      const currentSessionId = ui.currentSessionId;
      return {
        currentSessionId,
        webSearchEnabled: ai?.webSearchEnabled === true,
        generating: currentSessionId ? ui.generatingSessions[currentSessionId] === true : false,
        sessions: ai?.sessions.map((session) => ({ ...session })) ?? [],
        messages: Object.fromEntries(
          Object.entries(ai?.messages ?? {}).map(([sessionId, messages]) => [
            sessionId,
            messages.map((message) => ({
              ...message,
              versions: message.versions.map((version) => ({
                ...version,
                subsequentMessages: [...(version.subsequentMessages ?? [])],
              })),
            })),
          ]),
        ),
      };
    },
  };
}
