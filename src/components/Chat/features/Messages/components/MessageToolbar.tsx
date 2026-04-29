import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { subscribeChatMessageCopied } from '@/components/Chat/common/copyFeedback';

const COPY_FEEDBACK_DURATION_MS = 1200;
const COPY_FEEDBACK_CLOSING_MS = 160;

type CopyFeedbackSource = 'manual' | 'shortcut' | null;

interface MessageToolbarProps {
  msg: ChatMessage;
  isLoading: boolean;
  onCopy: (text: string) => Promise<boolean | void> | boolean | void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export const MessageToolbar = memo(function MessageToolbar({
  msg,
  isLoading,
  onCopy,
  onRegenerate,
  onSwitchVersion
}: MessageToolbarProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isCopyClosing, setIsCopyClosing] = useState(false);
  const [copyFeedbackSource, setCopyFeedbackSource] = useState<CopyFeedbackSource>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versions = msg.versions;
  const currentIndex = msg.currentVersionIndex;
  const currentVer = currentIndex + 1;
  const totalVer = versions.length;

  const triggerCopiedState = useCallback((source: CopyFeedbackSource) => {
      setIsCopied(true);
      setIsCopyClosing(false);
      setCopyFeedbackSource(source);
      if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
      }
      if (closingTimerRef.current) {
          clearTimeout(closingTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
          setIsCopied(false);
          setIsCopyClosing(true);
          copiedTimerRef.current = null;
          closingTimerRef.current = setTimeout(() => {
              setIsCopyClosing(false);
              setCopyFeedbackSource(null);
              closingTimerRef.current = null;
          }, COPY_FEEDBACK_CLOSING_MS);
      }, COPY_FEEDBACK_DURATION_MS);
  }, []);

  useEffect(() => {
      return subscribeChatMessageCopied((messageId) => {
          if (messageId !== msg.id) {
              return;
          }
          triggerCopiedState('shortcut');
      });
  }, [msg.id, triggerCopiedState]);

  useEffect(() => {
      return () => {
          if (copiedTimerRef.current) {
              clearTimeout(copiedTimerRef.current);
          }
          if (closingTimerRef.current) {
              clearTimeout(closingTimerRef.current);
          }
      };
  }, []);

  const handleCopy = async () => {
      const cleanContent = stripThinkingContent(msg.content);
      try {
          const didCopy = await onCopy(cleanContent);
          if (didCopy !== false) {
              triggerCopiedState('manual');
          }
      } catch (error) {
          console.error('[MessageToolbar] Failed to copy message:', error);
      }
  };

  if (isLoading) return null;

  const isCopyFeedbackVisible = isCopied || isCopyClosing;
  const secondaryActionClass = cn(
    "transition-opacity duration-200",
    isCopyClosing
      ? "opacity-0 pointer-events-none"
      : isCopied
        ? copyFeedbackSource === 'manual'
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        : "opacity-100"
  );

  return (
    <div className="flex flex-col mt-1">
        <div
          className={cn(
            "flex items-center gap-1 select-none transition-opacity duration-200",
            isCopied ? "opacity-100" : isCopyClosing ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          )}
        >
            
            {totalVer > 1 && (
                <div className={cn("flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors mr-2", secondaryActionClass)}>
                    <button onClick={() => onSwitchVersion(currentIndex - 1)} disabled={currentIndex <= 0} className={cn("p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded", iconButtonStyles)}><Icon name="nav.chevronLeft" size="md"/></button>
                    <span className="mx-1 font-mono">{currentVer}/{totalVer}</span>
                    <button onClick={() => onSwitchVersion(currentIndex + 1)} disabled={currentIndex >= totalVer - 1} className={cn("p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded", iconButtonStyles)}><Icon name="nav.chevronRight" size="md"/></button>
                </div>
            )}
            
            <button 
                onClick={handleCopy} 
                className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles)} 
            >
                {isCopyFeedbackVisible ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
            </button>

            {!isCopyClosing && (
              <button onClick={onRegenerate} className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles, secondaryActionClass)}>
                <Icon name="common.refresh" size="md" />
              </button>
            )}
        </div>
    </div>
  );
});
