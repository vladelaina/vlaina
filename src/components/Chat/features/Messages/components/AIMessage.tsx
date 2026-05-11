import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/Chat/features/Markdown/MarkdownRenderer';
import { MessageToolbar } from './MessageToolbar';
import { ErrorBlock } from './ErrorBlock';
import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag } from '@/lib/ai/errorTag';
import { extractWebSearchStatuses } from '@/lib/ai/webSearch/statusMarkup';
import { WebSearchStatusBlock } from '@/components/Chat/features/WebSearch/WebSearchStatusBlock';

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
  const visibleContent = contentWithoutError || ' ';
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
    <div className="w-full pl-[15px]">
        <div className="[&>*:last-child]:mb-0">
            <WebSearchStatusBlock statuses={webSearchStatuses} />
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

        {errorContent && (
            <div className="mt-2">
                <ErrorBlock 
                    type={errorType} 
                    code={errorCode} 
                    content={errorContent} 
                />
            </div>
        )}

        <MessageToolbar 
            msg={msg}
            isLoading={isLoading}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onSwitchVersion={onSwitchVersion}
        />
    </div>
  );
}
