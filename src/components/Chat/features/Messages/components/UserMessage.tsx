import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { resolveUserMessageBubbleWidth } from '@/components/Chat/features/Layout/chatUserBubbleWidth';
import { ChatImageViewer } from '@/components/Chat/features/Markdown/components/ChatImageViewer';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { UserMessageEditor } from './UserMessageEditor';
import {
  isSvgSource,
  parseUserMessageContent,
} from './userMessageContent';
import { useUIStore } from '@/stores/uiSlice';

const userMessageActionButtonClass =
  'p-1.5 rounded-md text-[var(--chat-sidebar-text)] transition-colors hover:bg-black/5 hover:text-[var(--chat-sidebar-text)] dark:hover:bg-white/5';

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
  const fontSize = useUIStore((state) => state.fontSize);
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
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
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
    () => resolveUserMessageBubbleWidth(parsedContent.text, containerWidth, fontSize),
    [containerWidth, fontSize, parsedContent.text]
  );
  const textBubbleStyle = useMemo(
    () => ({
      ...(textBubbleWidth ? { width: `${textBubbleWidth}px` } : {}),
      fontSize: 'var(--vlaina-markdown-font-size, 17px)',
      lineHeight: 'calc(var(--vlaina-markdown-font-size, 17px) + 8px)',
    }),
    [textBubbleWidth],
  );
  const imageGallery = useMemo(
    () => parsedContent.imageSources.map((src, index) => ({
      id: `${message.id}:${index}`,
      src,
    })),
    [message.id, parsedContent.imageSources],
  );
  const activeImage = imageGallery.find((item) => item.id === activeImageId) ?? null;
  const hasMultipleImages = parsedContent.imageSources.length > 1;

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
            {parsedContent.imageSources.length > 0 && (
              <div
                data-no-focus-input="true"
                className="flex max-w-[90%] flex-wrap justify-end gap-2"
              >
                {parsedContent.imageSources.map((src, index) => (
                  <div
                    key={`${src}:${index}`}
                    className={cn(
                      'overflow-hidden rounded-2xl p-1',
                      chatComposerPillSurfaceClass,
                    )}
                  >
                    <LocalImage
                      src={src}
                      alt="attachment"
                      className={cn(
                        'rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity',
                        hasMultipleImages
                          ? isSvgSource(src)
                            ? 'h-auto w-36 max-h-36'
                            : 'max-h-36 max-w-36'
                          : isSvgSource(src)
                            ? 'w-64 h-auto'
                            : 'max-h-64 max-w-xs'
                      )}
                      onClick={() => setActiveImageId(`${message.id}:${index}`)}
                    />
                  </div>
                ))}
              </div>
            )}
            {activeImage && (
              <ChatImageViewer
                open={!!activeImage}
                src={activeImage.src}
                alt="attachment"
                gallery={imageGallery}
                currentImageId={activeImage.id}
                onOpenChange={(open) => {
                  if (!open) {
                    setActiveImageId(null);
                  }
                }}
              />
            )}
            {parsedContent.text && (
              <div
                data-no-focus-input="true"
                data-chat-selection-surface="true"
                data-chat-selection-start="true"
                className="inline-block max-w-[90%] select-text rounded-3xl bg-[#41a8ea] px-4 py-1.5 text-left text-white"
                style={textBubbleStyle}
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
                  className={userMessageActionButtonClass}
                >
                  {isCopied ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
                </button>

                <button
                  onClick={handleStartEditing}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    onEdit
                      ? userMessageActionButtonClass
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
