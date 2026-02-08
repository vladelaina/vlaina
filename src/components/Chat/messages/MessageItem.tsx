import { memo } from 'react';
import { cn } from '@/lib/utils';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageItemProps {
  msg: ChatMessage;
  isLoading: boolean;
  isSpeaking: boolean;
  isSourcesOpen: boolean;
  onCopy: (text: string) => void;
  onSpeak: (id: string, text: string) => void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void; // Added onEdit
  onSwitchVersion: (id: string, dir: 'prev' | 'next') => void;
  onToggleSources: (id: string) => void;
}

export const MessageItem = memo(function MessageItem({
  msg,
  isLoading,
  isSpeaking,
  isSourcesOpen,
  onCopy,
  onSpeak,
  onRegenerate,
  onEdit, // Destructure
  onSwitchVersion,
  onToggleSources
}: MessageItemProps) {
  const isUser = msg.role === 'user';

  return (
    <div
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
                  content={msg.content} 
                  onEdit={onEdit ? (newContent) => onEdit(msg.id, newContent) : undefined}
              />
          ) : (
              <AIMessage 
                  msg={msg}
                  isLoading={isLoading}
                  isSpeaking={isSpeaking}
                  isSourcesOpen={isSourcesOpen}
                  onCopy={() => onCopy(msg.content)}
                  onSpeak={() => onSpeak(msg.id, msg.content)}
                  onRegenerate={() => onRegenerate(msg.id)}
                  onSwitchVersion={(dir) => onSwitchVersion(msg.id, dir)}
                  onToggleSources={() => onToggleSources(msg.id)}
              />
          )}
      </div>
    </div>
  );
});