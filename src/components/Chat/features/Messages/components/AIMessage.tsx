import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/Chat/features/Markdown/MarkdownRenderer';
import { MessageToolbar } from './MessageToolbar';
import { ErrorBlock } from './ErrorBlock';
import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag } from '@/lib/ai/errorTag';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { extractWebSearchStatuses } from '@/lib/ai/webSearch/statusMarkup';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { WebSearchStatusBlock } from '@/components/Chat/features/WebSearch/WebSearchStatusBlock';
import { useAccountSessionStore } from '@/stores/accountSession';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

type ChatImageGalleryGetter = () => ChatImageGalleryItem[];

const STREAM_START_CACHE_LIMIT = 200;
const visibleStreamStartTimeByMessageId = new Map<string, number>();

function rememberVisibleStreamStartTime(messageId: string): Date {
  const cached = visibleStreamStartTimeByMessageId.get(messageId);
  if (cached !== undefined) {
    visibleStreamStartTimeByMessageId.delete(messageId);
    visibleStreamStartTimeByMessageId.set(messageId, cached);
    return new Date(cached);
  }

  const startedAt = Date.now();
  if (visibleStreamStartTimeByMessageId.size >= STREAM_START_CACHE_LIMIT) {
    const oldestMessageId = visibleStreamStartTimeByMessageId.keys().next().value;
    if (oldestMessageId !== undefined) {
      visibleStreamStartTimeByMessageId.delete(oldestMessageId);
    }
  }
  visibleStreamStartTimeByMessageId.set(messageId, startedAt);
  return new Date(startedAt);
}

interface AIMessageProps {
  msg: ChatMessage;
  imageGallery?: ChatImageGalleryItem[];
  getImageGallery?: ChatImageGalleryGetter;
  isLoading: boolean;
  suspendStreamAnimation?: boolean;
  onCopy: (text: string) => Promise<boolean | void> | boolean | void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

function isManagedModelMessage(modelId: string): boolean {
  return modelId === MANAGED_PROVIDER_ID || modelId.startsWith(`${MANAGED_PROVIDER_ID}:`);
}

export function AIMessage({
  msg,
  imageGallery,
  getImageGallery,
  isLoading,
  suspendStreamAnimation = false,
  onCopy,
  onRegenerate,
  onSwitchVersion
}: AIMessageProps) {
  const isAccountConnected = useAccountSessionStore((state) => state.isConnected);
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);
  const copiedCodeBlockTimerRef = useRef<number | null>(null);
  const {
    errorType,
    errorCode,
    errorContent,
    webSearchStatuses,
    contentWithoutError,
  } = useMemo(() => {
    const parsedError = parseErrorTag(msg.content);
    const nextErrorContent = parsedError?.content ?? null;
    const withoutError = nextErrorContent
      ? msg.content.replace(/<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/i, '')
      : msg.content;
    const webSearch = extractWebSearchStatuses(withoutError);

    return {
      errorType: parsedError?.type,
      errorCode: parsedError?.code,
      errorContent: nextErrorContent,
      webSearchStatuses: webSearch.statuses,
      contentWithoutError: webSearch.content,
    };
  }, [msg.content]);
  const isStreamingContentVisible = isLoading && contentWithoutError.trim().length > 0;
  const isEmptyCompletedResponse = !isLoading && stripThinkingContent(contentWithoutError).trim().length === 0;
  const visibleContent = contentWithoutError || ' ';
  const isManagedModelAuthError = !isAccountConnected
    && errorType === 'AUTH_ERROR'
    && isManagedModelMessage(msg.modelId);
  const shouldHideManagedAuthError = isAccountConnected
    && errorType === 'AUTH_ERROR'
    && isManagedModelMessage(msg.modelId);
  const isManagedModelQuotaError = errorType === 'QUOTA_EXHAUSTED'
    && isManagedModelMessage(msg.modelId);
  const startTime = useMemo(() => {
    if (isStreamingContentVisible) {
      return rememberVisibleStreamStartTime(msg.id);
    }

    return msg.timestamp ? new Date(msg.timestamp) : undefined;
  }, [isStreamingContentVisible, msg.id, msg.timestamp]);

  useEffect(() => {
    setCopiedCodeBlockId(null);
    if (copiedCodeBlockTimerRef.current !== null) {
      window.clearTimeout(copiedCodeBlockTimerRef.current);
      copiedCodeBlockTimerRef.current = null;
    }
  }, [msg.id]);

  useEffect(() => {
    return () => {
      if (copiedCodeBlockTimerRef.current !== null) {
        window.clearTimeout(copiedCodeBlockTimerRef.current);
      }
    };
  }, []);

  const handleCodeBlockCopy = useCallback((blockId: string) => {
    setCopiedCodeBlockId(blockId);
    if (copiedCodeBlockTimerRef.current !== null) {
      window.clearTimeout(copiedCodeBlockTimerRef.current);
    }
    copiedCodeBlockTimerRef.current = window.setTimeout(() => {
      setCopiedCodeBlockId((currentBlockId) => currentBlockId === blockId ? null : currentBlockId);
      copiedCodeBlockTimerRef.current = null;
    }, 1200);
  }, []);

  return (
    <div className="w-full pl-[15px]" data-chat-selection-surface="true">
        <div className="[&>*:last-child]:mb-0">
            <WebSearchStatusBlock
                statuses={webSearchStatuses}
                isWaitingForAnswer={isLoading && stripThinkingContent(contentWithoutError).trim().length === 0}
            />
            <MarkdownRenderer
                content={visibleContent}
                imageGallery={imageGallery}
                getImageGallery={getImageGallery}
                imageIdBase={msg.id}
                codeBlockIdBase={msg.id}
                copiedCodeBlockId={copiedCodeBlockId}
                onCopyCodeBlock={handleCodeBlockCopy}
                startTime={startTime}
                isStreaming={isStreamingContentVisible}
                suspendStreamAnimation={suspendStreamAnimation}
            />
        </div>

        {errorContent && !shouldHideManagedAuthError && (
            <div className="mt-2">
                <ErrorBlock 
                    type={errorType} 
                    code={errorCode} 
                    content={errorContent} 
                    showLoginPrompt={isManagedModelAuthError}
                    showBillingPrompt={isManagedModelQuotaError}
                />
            </div>
        )}

        {!isManagedModelAuthError && (
            <MessageToolbar 
                msg={msg}
                isLoading={isLoading}
                forceVisible={isEmptyCompletedResponse}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                onSwitchVersion={onSwitchVersion}
            />
        )}
    </div>
  );
}
