import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { ChatImageViewer } from '@/components/Chat/features/Markdown/components/ChatImageViewer';
import {
  chatComposerFileAttachmentIconClass,
  chatComposerFileAttachmentLabelClass,
  chatComposerFileAttachmentTokenClass,
} from '../composerStyles';
import { ChatAttachmentRemoveButton } from './ChatAttachmentRemoveButton';

interface ChatAttachmentPreviewListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function ChatAttachmentPreviewList({ attachments, onRemove }: ChatAttachmentPreviewListProps) {
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const imageGallery = useMemo(
    () => attachments
      .filter((attachment) => attachment.type.startsWith('image/'))
      .map((attachment) => ({
        id: attachment.id,
        src: attachment.previewUrl,
      })),
    [attachments],
  );
  const activeImage = imageGallery.find((item) => item.id === activeImageId) ?? null;

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div
        data-chat-attachment-preview-list="true"
        className="max-h-[min(10rem,38vh)] overflow-y-auto overflow-x-hidden px-1 pt-4 pb-1 scrollbar-none sm:px-4"
      >
        <div className="flex w-full min-w-0 flex-wrap content-start items-start gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              data-chat-attachment-preview="true"
              className="relative group min-w-0 max-w-full shrink-0"
            >
              {attachment.type.startsWith('image/') ? (
                <>
                  <LocalImage
                    src={attachment.previewUrl}
                    alt={attachment.name || "preview"}
                    className="aspect-square w-16 max-w-full object-cover rounded-xl border border-[var(--vlaina-color-subtle-border)] transition-opacity hover:opacity-[var(--vlaina-opacity-90)]"
                    onClick={() => setActiveImageId(attachment.id)}
                  />
                  <ChatAttachmentRemoveButton
                    placement="image-thumbnail"
                    aria-label="Remove attachment"
                    data-no-focus-input="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(attachment.id);
                    }}
                  />
                </>
              ) : (
                <span
                  className={chatComposerFileAttachmentTokenClass}
                  style={{ maxWidth: 'min(16rem, calc(100% - 0.5rem))' }}
                  data-chat-file-attachment-token="true"
                  data-no-focus-input="true"
                >
                  <Icon name="file.attach" size="xs" className={chatComposerFileAttachmentIconClass} />
                  <span className={chatComposerFileAttachmentLabelClass}>{attachment.name || 'attachment'}</span>
                  <ChatAttachmentRemoveButton
                    placement="file-token"
                    aria-label="Remove attachment"
                    data-no-focus-input="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(attachment.id);
                    }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {activeImage && (
        <ChatImageViewer
          open={!!activeImage}
          src={activeImage.src}
          alt="preview"
          gallery={imageGallery}
          currentImageId={activeImage.id}
          onOpenChange={(open) => {
            if (!open) {
              setActiveImageId(null);
            }
          }}
        />
      )}
    </>
  );
}
