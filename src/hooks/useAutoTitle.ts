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
          
          // No signal passed, runs in background independently
          const title = await openaiClient.sendMessage(
              prompt,
              [], 
              { id: modelId } as any,
              provider
          );
          
          const cleanTitle = title
              .replace(/<think>[\s\S]*?<\/think>/gi, '') 
              .replace(/^["']|["']$/g, '') 
              .trim();

          if (cleanTitle) {
              console.log('[AutoTitle] Updated title:', cleanTitle);
              updateSession(sessionId, { title: cleanTitle });
          }
      } catch (e) {
          // Silent fail is intentional for background tasks, but logging for debug
          console.warn('[AutoTitle] Skipped:', e);
      }
  }, [providers, updateSession]);

  return { generateAutoTitle };
}