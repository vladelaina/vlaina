import { useEffect, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/Chat/features/Markdown/MarkdownRenderer';
import { MessageToolbar } from './MessageToolbar';
import { ErrorBlock } from './ErrorBlock';
import { ChatLoading } from './ChatLoading';
import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag } from '@/lib/ai/errorTag';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

interface AIMessageProps {
  msg: ChatMessage;
  imageGallery: ChatImageGalleryItem[];
  isLoading: boolean;
  onCopy: (text: string) => Promise<void> | void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export function AIMessage({
  msg,
  imageGallery,
  isLoading,
  onCopy,
  onRegenerate,
  onSwitchVersion
}: AIMessageProps) {
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);
  const copiedCodeBlockTimerRef = useRef<number | null>(null);

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

  const parsedError = parseErrorTag(msg.content);
  const errorType = parsedError?.type;
  const errorCode = parsedError?.code;
  const errorContent = parsedError?.content ?? null;
  const contentWithoutError = errorContent ? msg.content.replace(/<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/i, '') : msg.content;
  const shouldShowInlineLoading = isLoading && !!contentWithoutError.trim();

  const handleCodeBlockCopy = (blockId: string) => {
    setCopiedCodeBlockId(blockId);
    if (copiedCodeBlockTimerRef.current !== null) {
      window.clearTimeout(copiedCodeBlockTimerRef.current);
    }
    copiedCodeBlockTimerRef.current = window.setTimeout(() => {
      setCopiedCodeBlockId((currentBlockId) => currentBlockId === blockId ? null : currentBlockId);
      copiedCodeBlockTimerRef.current = null;
    }, 1200);
  };

  return (
    <div className="w-full pl-[15px]">
        <div className="[&>*:last-child]:mb-0">
            <MarkdownRenderer 
                content={contentWithoutError || ' '} 
                imageGallery={imageGallery}
                imageIdBase={msg.id}
                codeBlockIdBase={msg.id}
                copiedCodeBlockId={copiedCodeBlockId}
                onCopyCodeBlock={handleCodeBlockCopy}
                isStreaming={isLoading}
                startTime={msg.timestamp ? new Date(msg.timestamp) : undefined}
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

        {shouldShowInlineLoading && (
            <div className="-mt-1 mb-1">
                <ChatLoading />
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
