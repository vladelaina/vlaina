import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';

export function useAutoTitle() {
  const { providers, getModel, updateSession } = useAIStore();

  const generateAutoTitle = useCallback(async (sessionId: string, userText: string, providerId: string, modelId: string) => {
      try {
          const provider = providers.find(p => p.id === providerId);
          if (!provider) return;
          if (provider.enabled === false) return;
          const model = getModel(modelId);
          if (!model) return;

          const prompt = `Generate an extremely short title (max 5 words or 10 Chinese characters) for this chat session based on the following conversation content.
Rules:
1. STRICTLY use the SAME LANGUAGE as the user's message.
2. Do not use quotes, punctuation, or "Title:".
3. Keep it extremely concise.

Conversation Content: ${userText}`;
          
          // No signal passed, runs in background independently
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

          if (cleanTitle) {
              updateSession(sessionId, { title: cleanTitle });
          }
      } catch {
          // Silent fail is intentional for background tasks.
      }
  }, [providers, getModel, updateSession]);

  return { generateAutoTitle };
}
