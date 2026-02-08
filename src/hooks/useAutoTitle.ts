import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';

export function useAutoTitle() {
  const { providers, updateSession } = useAIStore();

  const generateAutoTitle = useCallback(async (sessionId: string, userText: string, providerId: string, modelId: string) => {
      try {
          const provider = providers.find(p => p.id === providerId);
          if (!provider) return;

          const prompt = `Generate a short, concise title (max 10 words) for this chat session based on the following user message.
Rules:
1. STRICTLY use the SAME LANGUAGE as the user's message (e.g. if user types in Chinese, title MUST be in Chinese).
2. Do not use quotes, punctuation, or "Title:".
3. Just the title text.

User Message: ${userText}`;
          
          // We use a non-streaming call for title (well, strictly it streams but we wait for full text)
          const title = await openaiClient.sendMessage(
              prompt,
              [], 
              { id: modelId } as any,
              provider
          );
          
          // Clean up title: remove <think> blocks and quotes
          const cleanTitle = title
              .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove reasoning chain
              .replace(/^["']|["']$/g, '') // Remove quotes
              .trim();

          if (cleanTitle) {
              updateSession(sessionId, { title: cleanTitle });
          }
      } catch (e) {
          console.warn('[AutoTitle] Failed to generate title:', e);
      }
  }, [providers, updateSession]);

  return { generateAutoTitle };
}
