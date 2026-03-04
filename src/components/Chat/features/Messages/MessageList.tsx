import { AnimatePresence } from 'framer-motion';
import { MessageItem } from './components/MessageItem';
import { ChatLoading } from '@/components/Chat/features/Messages/components/ChatLoading';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageListProps {
  messages: ChatMessage[];
  isSessionActive: boolean;
  showLoading: boolean;
  isLayoutCentered?: boolean;
  spacerHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string) => void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion: (msgId: string, idx: number) => void;
}

export function MessageList({
  messages,
  isSessionActive,
  showLoading,
  isLayoutCentered,
  spacerHeight,
  containerRef,
  onCopy,
  onRegenerate,
  onEdit,
  onSwitchVersion
}: MessageListProps) {
  const isEmpty = messages.length === 0;

  return (
      <div 
        data-chat-scrollable="true"
        className={cn(
            "flex-1 overflow-y-auto transition-opacity duration-500",
            isEmpty ? "opacity-0 pointer-events-none" : "opacity-100",
            isLayoutCentered && "hidden"
        )}
        ref={containerRef}
      >
        <div className="w-full max-w-[850px] mx-auto px-4 py-8 pb-4 min-h-full flex flex-col">
          {!isEmpty && (
            <div className="space-y-8">
              {messages.map((msg, idx) => (
                <div key={msg.id} data-message-index={idx}>
                    <MessageItem 
                        msg={msg}
                        isLoading={isSessionActive && idx === messages.length - 1} 
                        onCopy={onCopy}
                        onRegenerate={onRegenerate}
                        onEdit={onEdit}
                        onSwitchVersion={onSwitchVersion}
                    />
                </div>
              ))}
              <AnimatePresence>
                {showLoading && <ChatLoading key="loading" />}
              </AnimatePresence>
              
              <div style={{ height: spacerHeight }} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
  );
}
