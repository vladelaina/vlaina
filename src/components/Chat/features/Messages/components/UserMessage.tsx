import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { resolveUserMessageBubbleWidth } from '@/components/Chat/features/Layout/chatUserBubbleWidth';
import { ChatImageViewer } from '@/components/Chat/features/Markdown/components/ChatImageViewer';
import { chatComposerGhostIconButtonClass, chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { UserMessageEditor } from './UserMessageEditor';
import {
  isSvgSource,
  parseUserMessageContentWithKnownImages,
} from './userMessageContent';
import { useUIStore } from '@/stores/uiSlice';
import { MessageVersionNavigator } from './MessageVersionNavigator';

const userMessageActionButtonClass =
  cn(
    'flex h-7 w-7 items-center justify-center',
    iconButtonStyles,
    chatComposerGhostIconButtonClass,
    'text-[var(--vlaina-sidebar-chat-text)]',
  );

function isSwitchableUserVersion(version: ChatMessage['versions'][number]): boolean {
  return version.kind === 'original' || version.kind === 'edit';
}

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
    return parseUserMessageContentWithKnownImages(
      content,
      message.role === 'user' ? message.imageSources : undefined,
    );
  }, [content, message.imageSources, message.role]);

  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const versions = message.versions;
  const currentIdx = message.currentVersionIndex;
  const switchableVersionIndexes = versions
    .map((version, index) => isSwitchableUserVersion(version) ? index : -1)
    .filter((index) => index >= 0);
  const currentSwitchableIndex = switchableVersionIndexes.indexOf(currentIdx);
  const hasMultipleVersions = switchableVersionIndexes.length > 1 && currentSwitchableIndex >= 0;

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
      fontSize: 'var(--vlaina-markdown-font-size, var(--vlaina-size-17px))',
      lineHeight: 'calc(var(--vlaina-markdown-font-size, var(--vlaina-size-17px)) + var(--vlaina-size-8px))',
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
                className="flex max-w-[var(--vlaina-size-90pct)] flex-wrap justify-end gap-2"
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
                        'rounded-xl object-contain cursor-pointer hover:opacity-[var(--vlaina-opacity-90)] transition-opacity',
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
                data-vlaina-markdown-font-size-surface="true"
                className="inline-block max-w-[var(--vlaina-size-90pct)] select-text rounded-3xl bg-[var(--vlaina-accent)] px-4 py-1.5 text-left text-[var(--vlaina-color-white)]"
                style={textBubbleStyle}
              >
                <div className="whitespace-pre-wrap break-words">{parsedContent.text}</div>
              </div>
            )}
          </div>

          {!isAwaitingResponse && (
            <div className="flex items-center gap-2 opacity-[var(--vlaina-opacity-0)] group-hover:opacity-[var(--vlaina-opacity-100)] transition-opacity duration-[var(--vlaina-duration-150)] mr-1 mt-1">
              {hasMultipleVersions && onSwitchVersion && (
                <MessageVersionNavigator
                  current={currentSwitchableIndex + 1}
                  total={switchableVersionIndexes.length}
                  previousDisabled={currentSwitchableIndex <= 0}
                  nextDisabled={currentSwitchableIndex >= switchableVersionIndexes.length - 1}
                  onPrevious={() => {
                    const previousIndex = switchableVersionIndexes[currentSwitchableIndex - 1];
                    if (previousIndex !== undefined) {
                      onSwitchVersion(message.id, previousIndex);
                    }
                  }}
                  onNext={() => {
                    const nextIndex = switchableVersionIndexes[currentSwitchableIndex + 1];
                    if (nextIndex !== undefined) {
                      onSwitchVersion(message.id, nextIndex);
                    }
                  }}
                />
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Copy message"
                  data-chat-message-action="copy"
                  onClick={handleCopy}
                  className={userMessageActionButtonClass}
                >
                  {isCopied ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
                </button>

                <button
                  type="button"
                  aria-label="Edit message"
                  data-chat-message-action="edit"
                  onClick={handleStartEditing}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center',
                    onEdit
                      ? userMessageActionButtonClass
                      : 'rounded-full text-[var(--vlaina-color-text-disabled)] cursor-not-allowed'
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
