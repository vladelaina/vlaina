import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;

function createChunkScheduler(onFlush: (content: string) => void) {
  let pendingContent: string | null = null;
  let frameId: number | null = null;
  let frameKind: 'raf' | 'timeout' | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearScheduledFlush = () => {
    if (frameId !== null) {
      if (frameKind === 'raf' && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      } else {
        clearTimeout(frameId);
      }
      frameId = null;
      frameKind = null;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    if (pendingContent === null) {
      clearScheduledFlush();
      return;
    }

    const nextContent = pendingContent;
    pendingContent = null;
    clearScheduledFlush();
    onFlush(nextContent);
  };

  const scheduleFlush = () => {
    if (frameId === null) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        frameKind = 'raf';
        frameId = window.requestAnimationFrame(() => flush());
      } else {
        frameKind = 'timeout';
        frameId = setTimeout(() => flush(), 16) as unknown as number;
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(() => flush(), STREAM_CHUNK_FLUSH_MAX_DELAY_MS);
    }
  };

  return {
    push(content: string) {
      pendingContent = content;
      scheduleFlush();
    },
    flushNow() {
      flush();
    },
    cancel() {
      pendingContent = null;
      clearScheduledFlush();
    },
  };
}

export function useChatService() {
  const { generateAutoTitle } = useAutoTitle();

  const {
    messages: allMessages,
    currentSessionId,
    createSession,
    addMessage,
    updateMessage,
    completeMessage,
    editMessageAndBranch,
    addVersion,
    getSelectedModel,
    providers,
    temporaryChatEnabled,
    isTemporarySession,
    nativeWebSearchEnabled,
    customSystemPrompt,
    includeTimeContext,
    setSessionLoading,
    markSessionUnread,
    setError,
  } = useAIStore();

  const messages = currentSessionId ? allMessages[currentSessionId] || [] : [];
  const selectedModel = getSelectedModel();

  const stop = useCallback(() => {
    const sessionId = useUnifiedStore.getState().data.ai?.currentSessionId;
    if (!sessionId) return;
    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);
  }, [setSessionLoading]);

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[]) => {
      const isTextEmpty = !text || text.trim().length === 0;
      const hasNoAttachments = !attachments || attachments.length === 0;

      if ((isTextEmpty && hasNoAttachments) || !selectedModel) return;

      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) {
        setError('Provider not found');
        return;
      }

      const normalizedInput = text.replace(INVISIBLE_BREAK_REGEX, '').replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const userMessageText = normalizedInput.trim();

      let activeSessionId = currentSessionId;
      let isNewSession = false;
      if (!activeSessionId) {
        activeSessionId = createSession('');
        isNewSession = true;
      }

      const targetSessionId = activeSessionId;

      let storageContent = userMessageText;
      if (attachments.length > 0) {
        const imageMarkdown = attachments
          .filter((a) => a.type.startsWith('image/'))
          .map((a) => `![image](${a.assetUrl})`)
          .join('\n\n');
        storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
      }

      addMessage({
        role: 'user',
        content: storageContent,
        modelId: selectedModel.id,
      });

      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

      const controller = requestManager.start(targetSessionId);
      setSessionLoading(targetSessionId, true);
      setError(null);

      const isTemporaryTarget = isTemporarySession(targetSessionId);

      let shouldGenerateTitle = isNewSession && !temporaryChatEnabled && !isTemporaryTarget;
      if (!shouldGenerateTitle && targetSessionId && !temporaryChatEnabled && !isTemporaryTarget) {
        const state = useUnifiedStore.getState();
        const session = state.data.ai?.sessions.find((s) => s.id === targetSessionId);
        if (session && (session.title === 'New Chat' || session.title === 'New Image Chat')) {
          shouldGenerateTitle = true;
        }
      }

      if (shouldGenerateTitle && targetSessionId) {
        const titleSessionId = targetSessionId;
        generateAutoTitle(titleSessionId, userMessageText || 'Image Query', provider.id, selectedModel.id).catch((e) =>
          console.error(e)
        );
      }

      const streamScheduler = createChunkScheduler((nextContent) =>
        updateMessage(targetSessionId, assistantMessageId, nextContent)
      );

      try {
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history: messages,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt
        });

        let apiMessageContent: ChatMessageContent = userMessageText;
        if (attachments.length > 0) {
          const parts: ChatMessageContentPart[] = [];
          if (userMessageText) {
            parts.push({ type: 'text', text: userMessageText });
          }
          for (const att of attachments) {
            if (att.type.startsWith('image/')) {
              try {
                const base64 = await convertToBase64(att);
                parts.push({
                  type: 'image_url',
                  image_url: { url: base64 },
                });
              } catch (e) {
                console.error(e);
              }
            }
          }
          if (parts.length > 0) {
            apiMessageContent = parts;
          }
        }

        await openaiClient.sendMessage(
          apiMessageContent,
          requestHistory,
          selectedModel,
          provider,
          (chunk) => streamScheduler.push(chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        streamScheduler.flushNow();
        completeMessage(targetSessionId, assistantMessageId);

        const current = useUnifiedStore.getState().data.ai?.currentSessionId;
        if (targetSessionId !== current && !isTemporarySession(targetSessionId)) {
          markSessionUnread(targetSessionId);
        }
      } catch (error: any) {
        streamScheduler.flushNow();
        if (error.name === 'AbortError') {
          return;
        }

        const type = error.type || 'UNKNOWN';
        const code = error.statusCode || error.status || '';
        const detail = error.message || 'Unknown error occurred';
        const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;

        setError(detail);
        updateMessage(targetSessionId, assistantMessageId, errorXml);
      } finally {
        streamScheduler.cancel();
        requestManager.finish(targetSessionId, controller);
        setSessionLoading(targetSessionId, false);
      }
    },
    [
      currentSessionId,
      createSession,
      addMessage,
      updateMessage,
      completeMessage,
      selectedModel,
      providers,
      temporaryChatEnabled,
      isTemporarySession,
      nativeWebSearchEnabled,
      customSystemPrompt,
      includeTimeContext,
      setSessionLoading,
      setError,
      messages,
      generateAutoTitle,
      markSessionUnread,
    ]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !selectedModel) return;
      const sessionId = currentSessionId;
      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) return;
      const initialMessages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
      if (!initialMessages.some((m) => m.id === messageId)) {
        return;
      }

      editMessageAndBranch(sessionId, messageId, newContent);

      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

      const controller = requestManager.start(sessionId);
      setSessionLoading(sessionId, true);
      setError(null);

      const streamScheduler = createChunkScheduler((nextContent) =>
        updateMessage(sessionId, assistantMessageId, nextContent)
      );

      try {
        const state = useUnifiedStore.getState();
        const sessionMessages = state.data.ai?.messages[sessionId] || [];

        const userMsgIndex = sessionMessages.findIndex((m) => m.id === messageId);
        if (userMsgIndex === -1) {
          return;
        }
        const history = sessionMessages.slice(0, userMsgIndex);
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt
        });

        await openaiClient.sendMessage(
          newContent,
          requestHistory,
          selectedModel,
          provider,
          (chunk) => streamScheduler.push(chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        streamScheduler.flushNow();
        completeMessage(sessionId, assistantMessageId);
      } catch (error: any) {
        streamScheduler.flushNow();
        if (error.name === 'AbortError') {
          return;
        }

        const detail = error.message || 'Unknown error';
        const errorXml = `<error type="${error.type || 'UNKNOWN'}" code="${error.statusCode || ''}">${detail}</error>`;
        updateMessage(sessionId, assistantMessageId, errorXml);
      } finally {
        streamScheduler.cancel();
        requestManager.finish(sessionId, controller);
        setSessionLoading(sessionId, false);
      }
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      nativeWebSearchEnabled,
      customSystemPrompt,
      includeTimeContext,
      editMessageAndBranch,
      addMessage,
      updateMessage,
      completeMessage,
      setError,
      setSessionLoading,
    ]
  );

  const regenerate = useCallback(
    async (msgId: string) => {
      if (!selectedModel || !currentSessionId) return;
      const sessionId = currentSessionId;

      const msgIndex = messages.findIndex((m) => m.id === msgId);
      if (msgIndex <= 0) return;

      const promptMsg = messages[msgIndex - 1];
      if (promptMsg.role !== 'user') return;

      const history = messages.slice(0, msgIndex - 1);
      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) return;

      addVersion(msgId);

      const controller = requestManager.start(sessionId);
      setSessionLoading(sessionId, true);

      const streamScheduler = createChunkScheduler((nextContent) =>
        updateMessage(sessionId, msgId, nextContent)
      );

      try {
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt
        });

        await openaiClient.sendMessage(
          promptMsg.content,
          requestHistory,
          selectedModel,
          provider,
          (chunk) => streamScheduler.push(chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        streamScheduler.flushNow();
        completeMessage(sessionId, msgId);
      } catch (error: any) {
        streamScheduler.flushNow();
        if (error.name === 'AbortError') {
          return;
        }

        const type = error.type || 'UNKNOWN';
        const code = error.statusCode || error.status || '';
        const detail = error.message || 'Regeneration Failed';
        const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;

        setError(detail);
        updateMessage(sessionId, msgId, errorXml);
      } finally {
        streamScheduler.cancel();
        requestManager.finish(sessionId, controller);
        setSessionLoading(sessionId, false);
      }
    },
    [
      selectedModel,
      messages,
      providers,
      nativeWebSearchEnabled,
      customSystemPrompt,
      includeTimeContext,
      addVersion,
      setSessionLoading,
      updateMessage,
      completeMessage,
      setError,
      currentSessionId,
    ]
  );

  return { sendMessage, regenerate, editMessage, stop };
}
