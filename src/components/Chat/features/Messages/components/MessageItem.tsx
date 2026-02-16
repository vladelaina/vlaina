import { memo } from 'react';
import { cn } from '@/lib/utils';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageItemProps {
  msg: ChatMessage;
  isLoading: boolean;
  isSpeaking: boolean;
  onCopy: (text: string) => void;
  onSpeak: (id: string, text: string) => void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion: (id: string, targetIndex: number) => void;
}

export const MessageItem = memo(function MessageItem({
  msg,
  isLoading,
  isSpeaking,
  onCopy,
  onSpeak,
  onRegenerate,
  onEdit,
  onSwitchVersion
}: MessageItemProps) {
  const isUser = msg.role === 'user';

  return (
    <div
      data-message-item="true"
      data-role={msg.role}
      className={cn(
        "flex w-full group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div 
          className={cn(
              "flex flex-col min-w-0",
              isUser ? "items-end max-w-[85%]" : "w-full items-start"
          )}
      >
          {isUser ? (
              <UserMessage 
                  message={msg}
                  onEdit={onEdit}
                  onSwitchVersion={onSwitchVersion}
              />
          ) : (
              <AIMessage 
                  msg={msg}
                  isLoading={isLoading}
                  isSpeaking={isSpeaking}
                  onCopy={() => onCopy(msg.content)}
                  onSpeak={() => onSpeak(msg.id, msg.content)}
                  onRegenerate={() => onRegenerate(msg.id)}
                  onSwitchVersion={(idx) => onSwitchVersion(msg.id, idx)}
              />
          )}
      </div>
    </div>
  );
});
