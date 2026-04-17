import { useCallback, useRef } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { buildTitleSourceFromMessages, needsAutoTitle } from '@/lib/ai/temporaryChat';

export function useAutoTitle() {
  const providers = useUnifiedStore((state) => state.data.ai?.providers || []);
  const models = useUnifiedStore((state) => state.data.ai?.models || []);
  const inFlightSessionIdsRef = useRef(new Set<string>());

  const generateAutoTitle = useCallback(async (sessionId: string, providerId: string, modelId: string) => {
      if (inFlightSessionIdsRef.current.has(sessionId)) return;

      const ai = useUnifiedStore.getState().data.ai;
      const session = ai?.sessions.find((item) => item.id === sessionId);
      if (!session || !needsAutoTitle(session.title)) return;

      inFlightSessionIdsRef.current.add(sessionId);

      try {
          const provider = providers.find(p => p.id === providerId);
          if (!provider) return;
          if (provider.enabled === false) return;
          const model = models.find((item) => item.id === modelId);
          if (!model) return;
          const messages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
          const titleSource = buildTitleSourceFromMessages(messages);

          const prompt = `Generate an extremely short title (max 5 words or 10 Chinese characters) for this chat session based on the following conversation content.
Rules:
1. STRICTLY use the SAME LANGUAGE as the user's message.
2. Do not use quotes, punctuation, or "Title:".
3. Keep it extremely concise.

Conversation Content: ${titleSource}`;
          
          const title = await openaiClient.sendMessage(
              prompt,
              [], 
              model,
              provider
          );
          
          const cleanTitle = title
              .replace(/<think>[\s\S]*?<\/think>/gi, '') 
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
          console.warn('[useAutoTitle] title generation failed:', error);
        }
      } finally {
          inFlightSessionIdsRef.current.delete(sessionId);
      }
  }, [models, providers]);

  return { generateAutoTitle };
}
