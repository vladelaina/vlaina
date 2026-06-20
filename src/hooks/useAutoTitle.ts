import { useCallback } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { buildTitleSourceFromMessages, needsAutoTitle } from '@/lib/ai/temporaryChat';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { isStandaloneImageGenerationModel } from '@/lib/ai/modelCapabilities';
import { APP_LANGUAGES, type AppLanguage, useI18n } from '@/lib/i18n';
import { parseMarkdownAndHtmlImageTokens } from '@/lib/markdown/markdownImageTokens';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';

const AUTO_TITLE_TIMEOUT_MS = 12_000;
export const MAX_AUTO_TITLE_CHARS = 80;
const autoTitleInFlightSessionIds = new Set<string>();

function getAutoTitleLanguageLabel(language: AppLanguage): string {
  const option = APP_LANGUAGES.find((item) => item.code === language);
  return option ? `${option.nativeName} (${option.code})` : language;
}

export function buildAutoTitlePrompt(titleSource: string, language: AppLanguage): string {
  return `Name this chat in ${getAutoTitleLanguageLabel(language)}.
Max 5 words or 10 CJK characters. Return only the title, no quotes or punctuation.

USER_MESSAGES
${titleSource}`;
}

function cleanFallbackAutoTitle(title: string): string {
  return title.trim().slice(0, MAX_AUTO_TITLE_CHARS).trim() || 'Image';
}

function hasImageToken(value: string): boolean {
  return parseMarkdownAndHtmlImageTokens(value, { maxTokens: 1 }).length > 0;
}

function normalizeAutoTitleResponse(title: string, imageTitle: string): string {
  const withoutThinking = stripThinkingContent(title)
    .replace(/^["']|["']$/g, '')
    .trim();

  if (hasImageToken(withoutThinking)) {
    return cleanFallbackAutoTitle(imageTitle);
  }

  return withoutThinking
    .slice(0, MAX_AUTO_TITLE_CHARS)
    .trim();
}

function updateSessionAutoTitleIfCurrent(sessionId: string, title: string, titleSource: string): void {
  const cleanTitle = title.trim().slice(0, MAX_AUTO_TITLE_CHARS).trim();
  const latestSession = useUnifiedStore
    .getState()
    .data.ai?.sessions.find((item) => item.id === sessionId);
  const latestMessages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
  const latestTitleSource = buildTitleSourceFromMessages(latestMessages);

  if (
    cleanTitle
    && !needsAutoTitle(cleanTitle)
    && latestSession
    && needsAutoTitle(latestSession.title)
    && latestTitleSource === titleSource
  ) {
    aiActions.updateSession(sessionId, { title: cleanTitle });
  }
}

export function useAutoTitle() {
  const { language, t } = useI18n();
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
          const imageTitle = cleanFallbackAutoTitle(t('editor.slash.image'));

          if (isStandaloneImageGenerationModel(model)) {
            updateSessionAutoTitleIfCurrent(sessionId, imageTitle, titleSource);
            return;
          }

          const prompt = buildAutoTitlePrompt(titleSource, language);
          
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
          
          const cleanTitle = normalizeAutoTitleResponse(title, imageTitle);
          updateSessionAutoTitleIfCurrent(sessionId, cleanTitle, titleSource);
      } catch (error) {
        if (import.meta.env.DEV) {
        }
      } finally {
          autoTitleInFlightSessionIds.delete(sessionId);
      }
  }, [language, models, providers, t]);

  return { generateAutoTitle };
}
