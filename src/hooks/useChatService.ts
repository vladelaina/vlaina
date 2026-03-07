import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { dedupeNoteMentions } from '@/lib/ai/noteMentions';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;
const SVG_DATA_URL_REGEX = /^data:image\/svg\+xml/i;
const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const MAX_NOTE_MENTION_COUNT = 3;
const MAX_NOTE_MENTION_CHARS = 12000;

function isImageAttachment(attachment: Attachment): boolean {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) {
    return true;
  }

  const previewUrl = attachment.previewUrl?.trim().toLowerCase() ?? '';
  if (previewUrl.startsWith('data:image/')) {
    return true;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (IMAGE_NAME_REGEX.test(assetUrl)) {
    return true;
  }

  const name = attachment.name?.trim() ?? '';
  return IMAGE_NAME_REGEX.test(name);
}

function getAttachmentMessageImageSrc(attachment: Attachment): string {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  const previewUrl = attachment.previewUrl?.trim() ?? '';
  if (mimeType === 'image/svg+xml' && previewUrl.startsWith('data:image/')) {
    return previewUrl;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (assetUrl) {
    return assetUrl;
  }
  return previewUrl;
}

function toImageMarkdown(src: string): string {
  return `![image](<${src}>)`;
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/');
}

async function resolveMentionedNoteContent(notePath: string): Promise<string> {
  const notesState = useNotesStore.getState();

  if (notesState.currentNote?.path === notePath) {
    return notesState.currentNote.content || '';
  }

  const cached = notesState.noteContentsCache.get(notePath);
  if (typeof cached === 'string') {
    return cached;
  }

  const storage = getStorageAdapter();
  try {
    if (isAbsolutePath(notePath)) {
      return await storage.readFile(notePath);
    }
    if (!notesState.notesPath) {
      return '';
    }
    const fullPath = await joinPath(notesState.notesPath, notePath);
    return await storage.readFile(fullPath);
  } catch {
    return '';
  }
}

function buildMentionedNotesContext(
  mentionedNotes: Array<NoteMentionReference & { content: string }>
): string {
  if (mentionedNotes.length === 0) {
    return '';
  }

  const sections = mentionedNotes.map((note) => {
    const boundedContent = note.content.slice(0, MAX_NOTE_MENTION_CHARS);
    return `## ${note.title}\n${boundedContent}`;
  });

  return [
    'Referenced notes (Markdown):',
    '',
    sections.join('\n\n---\n\n'),
    '',
    'Answer based on these notes plus the user request.',
  ].join('\n');
}

function decodeSvgDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (/;base64/i.test(meta)) {
      return window.atob(payload);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function pickSvgRenderSize(svgText: string): { width: number; height: number } {
  const clamp = (value: number) => Math.max(1, Math.min(4096, Math.round(value)));
  const parsePositive = (value: string | undefined) => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthMatch = /\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const heightMatch = /\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const widthFromAttr = parsePositive(widthMatch?.[1]);
  const heightFromAttr = parsePositive(heightMatch?.[1]);
  if (widthFromAttr && heightFromAttr) {
    return { width: clamp(widthFromAttr), height: clamp(heightFromAttr) };
  }

  const viewBoxMatch = /\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i.exec(svgText);
  const widthFromViewBox = parsePositive(viewBoxMatch?.[1]);
  const heightFromViewBox = parsePositive(viewBoxMatch?.[2]);
  if (widthFromViewBox && heightFromViewBox) {
    return { width: clamp(widthFromViewBox), height: clamp(heightFromViewBox) };
  }

  return { width: 1024, height: 1024 };
}

async function rasterizeSvgDataUrlToPng(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined') {
    return dataUrl;
  }

  const svgText = decodeSvgDataUrl(dataUrl);
  const { width, height } = pickSvgRenderSize(svgText ?? '');

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function normalizeVisionImageDataUrl(dataUrl: string): Promise<string> {
  if (!SVG_DATA_URL_REGEX.test(dataUrl.trim())) {
    return dataUrl;
  }
  return rasterizeSvgDataUrlToPng(dataUrl);
}

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
    async (text: string, attachments: Attachment[], noteMentions: NoteMentionReference[] = []) => {
      const isTextEmpty = !text || text.trim().length === 0;
      const hasNoAttachments = !attachments || attachments.length === 0;
      const normalizedMentions = dedupeNoteMentions(noteMentions).slice(0, MAX_NOTE_MENTION_COUNT);
      const hasNoMentions = normalizedMentions.length === 0;

      if ((isTextEmpty && hasNoAttachments && hasNoMentions) || !selectedModel) return;

      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) {
        setError('Provider not found');
        return;
      }

      const normalizedInput = text.replace(INVISIBLE_BREAK_REGEX, '').replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const userMessageText = normalizedInput.trim();
      const mentionText = normalizedMentions.map((mention) => `@${mention.title}`).join(' ');

      let activeSessionId = currentSessionId;
      let isNewSession = false;
      if (!activeSessionId) {
        activeSessionId = createSession('');
        isNewSession = true;
      }

      const targetSessionId = activeSessionId;

      let storageContent = userMessageText;
      const messageImageSources: string[] = [];
      if (attachments.length > 0) {
        const imageMarkdown = attachments
          .filter(isImageAttachment)
          .map((a) => getAttachmentMessageImageSrc(a))
          .filter((src) => src.length > 0)
          .map((src) => {
            messageImageSources.push(src);
            return toImageMarkdown(src);
          })
          .join('\n\n');
        storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
      }

      if (!storageContent.trim() && normalizedMentions.length > 0) {
        storageContent = mentionText;
      }

      addMessage({
        role: 'user',
        content: storageContent,
        imageSources: messageImageSources,
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

        const mentionedNotes = (
          await Promise.all(
            normalizedMentions.map(async (mention) => ({
              ...mention,
              content: (await resolveMentionedNoteContent(mention.path)).trim(),
            }))
          )
        ).filter((note) => note.content.length > 0);

        const notesContext = buildMentionedNotesContext(mentionedNotes);
        const requestText = userMessageText;
        const textPayload = notesContext
          ? requestText
            ? `${notesContext}\n\nUser request:\n${requestText}`
            : `${notesContext}\n\nUser request: (none)`
          : requestText;

        let apiMessageContent: ChatMessageContent = textPayload;
        if (attachments.length > 0) {
          const parts: ChatMessageContentPart[] = [];
          if (textPayload) {
            parts.push({ type: 'text', text: textPayload });
          }
          for (const att of attachments) {
            if (isImageAttachment(att)) {
              try {
                const base64 = await convertToBase64(att);
                const normalizedBase64 = await normalizeVisionImageDataUrl(base64);
                parts.push({
                  type: 'image_url',
                  image_url: { url: normalizedBase64 },
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
          controller.signal
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
          controller.signal
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
          controller.signal
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
