import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { subscribeChatMessageCopied } from '@/components/Chat/common/copyFeedback';
import { MessageVersionNavigator } from './MessageVersionNavigator';

const COPY_FEEDBACK_DURATION_MS = 1200;
const COPY_FEEDBACK_CLOSING_MS = 160;
const sidebarTextIconButtonClass =
  "text-[var(--chat-sidebar-text)] hover:text-[var(--chat-sidebar-text)]";

type CopyFeedbackSource = 'manual' | 'shortcut' | null;

function isSwitchableAssistantVersion(version: ChatMessage['versions'][number]): boolean {
  return version.kind === 'original' || version.kind === 'regeneration';
}

interface MessageToolbarProps {
  msg: ChatMessage;
  isLoading: boolean;
  forceVisible?: boolean;
  showCopyAction?: boolean;
  showVersionNavigation?: boolean;
  onCopy: (text: string) => Promise<boolean | void> | boolean | void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export const MessageToolbar = memo(function MessageToolbar({
  msg,
  isLoading,
  forceVisible = false,
  showCopyAction = true,
  showVersionNavigation = true,
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
  const switchableVersionIndexes = versions
    .map((version, index) => isSwitchableAssistantVersion(version) ? index : -1)
    .filter((index) => index >= 0);
  const currentSwitchableIndex = switchableVersionIndexes.indexOf(currentIndex);
  const currentVer = currentSwitchableIndex + 1;
  const totalVer = switchableVersionIndexes.length;

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
    <div className="flex flex-col mt-1" data-chat-selection-excluded="true">
        <div
          className={cn(
            "flex items-center gap-1 select-none transition-opacity duration-200",
            isCopied || forceVisible
              ? "opacity-100"
              : isCopyClosing
                ? "opacity-0"
                : "opacity-0 group-hover:opacity-100"
          )}
        >
            
            {showVersionNavigation && totalVer > 1 && currentSwitchableIndex >= 0 && (
                <MessageVersionNavigator
                  current={currentVer}
                  total={totalVer}
                  previousDisabled={currentSwitchableIndex <= 0}
                  nextDisabled={currentSwitchableIndex >= totalVer - 1}
                  onPrevious={() => {
                    const previousIndex = switchableVersionIndexes[currentSwitchableIndex - 1];
                    if (previousIndex !== undefined) onSwitchVersion(previousIndex);
                  }}
                  onNext={() => {
                    const nextIndex = switchableVersionIndexes[currentSwitchableIndex + 1];
                    if (nextIndex !== undefined) onSwitchVersion(nextIndex);
                  }}
                  className={cn('mr-2', secondaryActionClass)}
                />
            )}
            
            {showCopyAction && (
              <button
                  onClick={handleCopy}
                  className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles, sidebarTextIconButtonClass)}
              >
                  {isCopyFeedbackVisible ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
              </button>
            )}

            {!isCopyClosing && (
              <button onClick={onRegenerate} className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles, secondaryActionClass, sidebarTextIconButtonClass)}>
                <Icon name="common.refresh" size="md" />
              </button>
            )}
        </div>
    </div>
  );
});
