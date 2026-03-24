import { AnimatePresence } from 'framer-motion';
import { MessageItem } from './components/MessageItem';
import { ChatLoading } from '@/components/Chat/features/Messages/components/ChatLoading';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  imageGallery: ChatImageGalleryItem[];
  isSessionActive: boolean;
  showLoading: boolean;
  isLayoutCentered?: boolean;
  useOverlayScrollbar?: boolean;
  spacerHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string) => Promise<void> | void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion: (msgId: string, idx: number) => void;
}

export function MessageList({
  messages,
  imageGallery,
  isSessionActive,
  showLoading,
  isLayoutCentered,
  useOverlayScrollbar = false,
  spacerHeight,
  containerRef,
  onCopy,
  onRegenerate,
  onEdit,
  onSwitchVersion
}: MessageListProps) {
  const isEmpty = messages.length === 0;
  const content = (
    <div className="w-full max-w-[850px] mx-auto px-4 py-8 pb-4 min-h-full flex flex-col">
      {!isEmpty && (
        <div className="space-y-8">
          {messages.map((msg, idx) => (
            <div key={msg.id} data-message-index={idx}>
              <MessageItem
                msg={msg}
                imageGallery={imageGallery}
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
  );

  if (useOverlayScrollbar) {
    return (
      <OverlayScrollArea
        ref={containerRef}
        data-chat-scrollable="true"
        className={cn(
          'transition-opacity duration-500',
          isEmpty ? 'pointer-events-none opacity-0' : 'opacity-100',
          isLayoutCentered && 'hidden',
        )}
        viewportClassName="h-full"
        scrollbarVariant="compact"
      >
        {content}
      </OverlayScrollArea>
    );
  }

  return (
      <div
        data-chat-scrollable="true"
        className={cn(
          'flex-1 overflow-y-auto transition-opacity duration-500',
          isEmpty ? 'pointer-events-none opacity-0' : 'opacity-100',
          isLayoutCentered && 'hidden',
        )}
        ref={containerRef}
      >
        {content}
      </div>
  );
}
