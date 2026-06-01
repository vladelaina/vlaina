import { useCallback } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { buildTitleSourceFromMessages, needsAutoTitle } from '@/lib/ai/temporaryChat';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';

const AUTO_TITLE_TIMEOUT_MS = 12_000;
const autoTitleInFlightSessionIds = new Set<string>();

export function useAutoTitle() {
  const providers = useUnifiedStore((state) => state.data.ai?.providers || []);
  const models = useUnifiedStore((state) => state.data.ai?.models || []);

  const generateAutoTitle = useCallback(async (sessionId: string, providerId: string, modelId: string) => {
      if (autoTitleInFlightSessionIds.has(sessionId)) return;

      const ai = useUnifiedStore.getState().data.ai;
      const session = ai?.sessions.find((item) => item.id === sessionId);
      if (!session || !needsAutoTitle(session.title)) return;

      autoTitleInFlightSessionIds.add(sessionId);

      try {
          const provider = providers.find(p => p.id === providerId);
          if (!provider) return;
          if (provider.enabled === false) return;
          const model = models.find((item) => item.id === modelId);
          if (!model) return;
          const messages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
          const titleSource = buildTitleSourceFromMessages(messages);

          const prompt = `Name this chat in the main language and script of USER_MESSAGES, ignoring this instruction language.
Max 5 words or 10 CJK characters. Return only the title, no quotes or punctuation.

USER_MESSAGES
${titleSource}`;
          
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), AUTO_TITLE_TIMEOUT_MS);
          let title = '';
          try {
            title = await sendMessageWithEndpointFallback({
              content: prompt,
              history: [],
              model,
              provider,
              onChunk: () => {},
              signal: controller.signal,
            });
          } finally {
            window.clearTimeout(timeoutId);
          }

          if (controller.signal.aborted) return;
          
          const cleanTitle = stripThinkingContent(title)
              .replace(/^["']|["']$/g, '') 
              .trim();

          const latestSession = useUnifiedStore
              .getState()
              .data.ai?.sessions.find((item) => item.id === sessionId);

          if (cleanTitle && !needsAutoTitle(cleanTitle) && latestSession && needsAutoTitle(latestSession.title)) {
              aiActions.updateSession(sessionId, { title: cleanTitle });
          }
      } catch (error) {
        if (import.meta.env.DEV) {
        }
      } finally {
          autoTitleInFlightSessionIds.delete(sessionId);
      }
  }, [models, providers]);

  return { generateAutoTitle };
}
