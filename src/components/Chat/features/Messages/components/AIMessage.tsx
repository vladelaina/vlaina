import MarkdownRenderer from '@/components/Chat/features/Markdown/MarkdownRenderer';
import { MessageToolbar } from './MessageToolbar';
import { ErrorBlock } from './ErrorBlock';
import type { ChatMessage } from '@/lib/ai/types';

interface AIMessageProps {
  msg: ChatMessage;
  isSpeaking: boolean;
  isLoading: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export function AIMessage({
  msg,
  isSpeaking,
  isLoading,
  onCopy,
  onSpeak,
  onRegenerate,
  onSwitchVersion
}: AIMessageProps) {
  
  const errorRegex = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/;
  const errorMatch = errorRegex.exec(msg.content);
  const errorType = errorMatch ? errorMatch[1] : undefined;
  const errorCode = errorMatch ? errorMatch[2] : undefined;
  const errorContent = errorMatch ? errorMatch[3] : null;

  const contentWithoutError = msg.content.replace(errorRegex, '');

  return (
    <div className="w-full pl-0">
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
        
        <MessageToolbar 
            msg={msg}
            isSpeaking={isSpeaking}
            isLoading={isLoading}
            onCopy={onCopy}
            onSpeak={onSpeak}
            onRegenerate={onRegenerate}
            onSwitchVersion={onSwitchVersion}
        />
    </div>
  );
}
