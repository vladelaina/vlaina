import MarkdownRenderer from '@/components/Chat/features/Markdown/MarkdownRenderer';
import { MessageToolbar } from './MessageToolbar';
import { ErrorBlock } from './ErrorBlock';
import { ChatLoading } from './ChatLoading';
import type { ChatMessage } from '@/lib/ai/types';

interface AIMessageProps {
  msg: ChatMessage;
  isLoading: boolean;
  onCopy: (text: string) => Promise<void> | void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export function AIMessage({
  msg,
  isLoading,
  onCopy,
  onRegenerate,
  onSwitchVersion
}: AIMessageProps) {
  
  const errorRegex = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/;
  const errorMatch = errorRegex.exec(msg.content);
  const errorType = errorMatch ? errorMatch[1] : undefined;
  const errorCode = errorMatch ? errorMatch[2] : undefined;
  const errorContent = errorMatch ? errorMatch[3] : null;

  const contentWithoutError = msg.content.replace(errorRegex, '');
  const shouldShowInlineLoading = isLoading && !!contentWithoutError.trim();

  return (
    <div className="w-full pl-[15px]">
        <div className="[&>*:last-child]:mb-0">
            <MarkdownRenderer 
                content={contentWithoutError || ' '} 
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
