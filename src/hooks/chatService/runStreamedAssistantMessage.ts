import { requestManager } from '@/lib/ai/requestManager';
import { createChunkScheduler, resolveAssistantContent } from './helpers';
import { logChatStreamDebug } from '@/stores/notes/lineBreakDebugLog';

export interface ChatErrorPayload {
  message: string;
  xml: string;
}

export type StreamedAssistantMessageStatus = 'completed' | 'aborted' | 'failed';

interface RunStreamedAssistantMessageOptions {
  sessionId: string;
  assistantMessageId: string;
  execute: (onChunk: (chunk: string) => void, signal: AbortSignal) => Promise<string>;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  completeMessage: (sessionId: string, messageId: string) => void;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  setError: (error: string | null) => void;
  buildErrorPayload: (error: unknown) => ChatErrorPayload;
  onSuccess?: () => void | Promise<void>;
}

export async function runStreamedAssistantMessage({
  sessionId,
  assistantMessageId,
  execute,
  updateMessage,
  completeMessage,
  setSessionLoading,
  setError,
  buildErrorPayload,
  onSuccess,
}: RunStreamedAssistantMessageOptions): Promise<StreamedAssistantMessageStatus> {
  const controller = requestManager.start(sessionId);
  setSessionLoading(sessionId, true);
  setError(null);
  logChatStreamDebug('message:start', {
    sessionId,
    assistantMessageId,
  });

  const streamScheduler = createChunkScheduler((nextContent) => {
    logChatStreamDebug('message:flush', {
      sessionId,
      assistantMessageId,
      length: nextContent.length,
      preview: nextContent.slice(0, 120),
    });
    updateMessage(sessionId, assistantMessageId, nextContent);
  });

  let lastStreamedContent = '';
  let status: StreamedAssistantMessageStatus = 'completed';

  try {
    const returnedContent = await execute((chunk) => {
      lastStreamedContent = chunk;
      logChatStreamDebug('message:chunk', {
        sessionId,
        assistantMessageId,
        length: chunk.length,
        preview: chunk.slice(0, 120),
      });
      streamScheduler.push(chunk);
    }, controller.signal);

    streamScheduler.flushNow();
    resolveAssistantContent(returnedContent, lastStreamedContent, (content) => {
      lastStreamedContent = content;
      logChatStreamDebug('message:resolve', {
        sessionId,
        assistantMessageId,
        length: content.length,
        preview: content.slice(0, 120),
      });
      updateMessage(sessionId, assistantMessageId, content);
    });
    completeMessage(sessionId, assistantMessageId);
    logChatStreamDebug('message:complete', {
      sessionId,
      assistantMessageId,
      status: 'completed',
      length: lastStreamedContent.length,
    });
  } catch (error) {
    streamScheduler.flushNow();

    const errorName =
      error instanceof Error
        ? error.name
        : error && typeof error === 'object' && 'name' in error && typeof error.name === 'string'
          ? error.name
          : '';

    if (controller.signal.aborted || errorName === 'AbortError') {
      if (lastStreamedContent) {
        updateMessage(sessionId, assistantMessageId, lastStreamedContent);
      }
      completeMessage(sessionId, assistantMessageId);
      status = 'aborted';
      logChatStreamDebug('message:aborted', {
        sessionId,
        assistantMessageId,
        length: lastStreamedContent.length,
      });
    } else {
      const { message, xml } = buildErrorPayload(error);
      setError(message);
      updateMessage(sessionId, assistantMessageId, xml);
      status = 'failed';
      logChatStreamDebug('message:error', {
        sessionId,
        assistantMessageId,
        error: message,
      });
    }
  } finally {
    streamScheduler.cancel();
    requestManager.finish(sessionId, controller);
    setSessionLoading(sessionId, false);
    logChatStreamDebug('message:finish', {
      sessionId,
      assistantMessageId,
      status,
      length: lastStreamedContent.length,
    });
  }

  if (status === 'completed' && onSuccess) {
    try {
      await onSuccess();
    } catch (error) {
      console.error('[chatService] post-success handler failed:', error);
    }
  }

  return status;
}
