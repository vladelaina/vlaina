import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { normalizeExternalHref, openExternalHref } from '@/lib/navigation/externalLinks';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { resolveUserMessageBubbleWidth } from '@/components/Chat/features/Layout/chatUserBubbleWidth';
import { UserMessageEditor } from './UserMessageEditor';
import {
  isSvgSource,
  parseUserMessageContent,
} from './userMessageContent';

interface UserMessageProps {
  message: ChatMessage;
  containerWidth: number;
  isAwaitingResponse?: boolean;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion?: (id: string, targetIndex: number) => void;
}

function UserMessageInner({
  message,
  containerWidth,
  isAwaitingResponse = false,
  onEdit,
  onSwitchVersion,
}: UserMessageProps) {
  const content = message.content || '';
  const parsedContent = useMemo(() => {
    const parsed = parseUserMessageContent(content);
    if (message.role === 'user' && message.imageSources && message.imageSources.length > 0) {
      return {
        ...parsed,
        imageSources: message.imageSources,
      };
    }
    return parsed;
  }, [content, message.imageSources, message.role]);

  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const versions = message.versions;
  const currentIdx = message.currentVersionIndex;
  const hasMultipleVersions = versions.length > 1;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const textBubbleWidth = useMemo(
    () => resolveUserMessageBubbleWidth(parsedContent.text, containerWidth),
    [containerWidth, parsedContent.text]
  );

  const handleCopy = useCallback(async () => {
    try {
      const didCopy = await copyMessageContentToClipboard(content);
      if (!didCopy) return;

      setIsCopied(true);
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setIsCopied(false);
        copiedTimerRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('[UserMessage] Failed to copy message:', error);
    }
  }, [content]);

  const handleStartEditing = useCallback(() => {
    if (!onEdit) {
      return;
    }
    setIsEditing(true);
  }, [onEdit]);

  return (
    <div className="group w-full flex flex-col items-end gap-1 max-w-full">
      {isEditing ? (
        <UserMessageEditor
          message={message}
          parsedContent={parsedContent}
          onEdit={onEdit}
          onClose={() => setIsEditing(false)}
        />
      ) : (
        <div className="w-full flex flex-col items-end">
          <div className="w-full flex flex-col items-end gap-2">
            {parsedContent.imageSources.map((src) => (
              <div
                key={src}
                data-no-focus-input="true"
                className="rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-white dark:bg-zinc-800"
              >
                <LocalImage
                  src={src}
                  alt="attachment"
                  className={cn(
                    'max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity',
                    isSvgSource(src) ? 'w-64 h-auto' : 'max-w-xs'
                  )}
                  onClick={() => {
                    const safeExternalHref = normalizeExternalHref(src);
                    if (safeExternalHref) {
                      void openExternalHref(safeExternalHref);
                      return;
                    }
                    window.open(src, '_blank', 'noopener,noreferrer');
                  }}
                />
              </div>
            ))}
            {parsedContent.text && (
              <div
                data-no-focus-input="true"
                className="inline-block max-w-[90%] rounded-3xl bg-[#41a8ea] px-4 py-1.5 text-left text-[15px] leading-6 text-white"
                style={textBubbleWidth ? { width: `${textBubbleWidth}px` } : undefined}
              >
                <div className="whitespace-pre-wrap break-words">{parsedContent.text}</div>
              </div>
            )}
          </div>

          {!isAwaitingResponse && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mr-1 mt-1">
              {hasMultipleVersions && onSwitchVersion && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-md p-0.5 select-none">
                  <button
                    onClick={() => {
                      currentIdx > 0 && onSwitchVersion(message.id, currentIdx - 1);
                    }}
                    disabled={currentIdx === 0}
                    className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    <Icon name="nav.chevronLeft" size="md" />
                  </button>
                  <span className="text-[10px] font-mono font-medium text-gray-600 dark:text-gray-400 min-w-[24px] text-center">
                    {currentIdx + 1} / {versions.length}
                  </span>
                  <button
                    onClick={() => {
                      currentIdx < versions.length - 1 && onSwitchVersion(message.id, currentIdx + 1);
                    }}
                    disabled={currentIdx === versions.length - 1}
                    className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    <Icon name="nav.chevronRight" size="md" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors"
                >
                  {isCopied ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
                </button>

                <button
                  onClick={handleStartEditing}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    onEdit
                      ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                      : 'text-gray-300 cursor-not-allowed'
                  )}
                >
                  <Icon name="common.compose" size="md" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function areUserMessagePropsEqual(prevProps: UserMessageProps, nextProps: UserMessageProps): boolean {
  return (
    prevProps.message === nextProps.message &&
    prevProps.containerWidth === nextProps.containerWidth &&
    prevProps.isAwaitingResponse === nextProps.isAwaitingResponse &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onSwitchVersion === nextProps.onSwitchVersion
  );
}

export const UserMessage = memo(UserMessageInner, areUserMessagePropsEqual);
