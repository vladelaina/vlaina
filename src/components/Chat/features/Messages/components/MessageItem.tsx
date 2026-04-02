import { memo } from 'react';
import { cn } from '@/lib/utils';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';
import type { ChatMessage } from '@/lib/ai/types';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

type ChatImageGalleryGetter = () => ChatImageGalleryItem[];

interface MessageItemProps {
  msg: ChatMessage;
  imageGallery?: ChatImageGalleryItem[];
  getImageGallery?: ChatImageGalleryGetter;
  isLoading: boolean;
  onCopy: (text: string) => Promise<void> | void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion: (id: string, targetIndex: number) => void;
}

export const MessageItem = memo(function MessageItem({
  msg,
  imageGallery,
  getImageGallery,
  isLoading,
  onCopy,
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
              isUser ? "items-end w-full" : "w-full items-start"
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
                  imageGallery={imageGallery}
                  getImageGallery={getImageGallery}
                  isLoading={isLoading}
                  onCopy={onCopy}
                  onRegenerate={() => onRegenerate(msg.id)}
                  onSwitchVersion={(idx) => onSwitchVersion(msg.id, idx)}
              />
          )}
      </div>
    </div>
  );
});
