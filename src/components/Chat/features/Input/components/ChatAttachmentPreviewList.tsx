import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { ChatImageViewer } from '@/components/Chat/features/Markdown/components/ChatImageViewer';

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
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(attachment.id);
                    }}
                    className="absolute right-1 top-1 z-[var(--vlaina-z-10)] inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--vlaina-color-attachment-remove-bg)] text-[var(--vlaina-color-attachment-remove-fg)] opacity-[var(--vlaina-opacity-0)] shadow-[var(--vlaina-shadow-sm)] ring-1 ring-[var(--vlaina-color-subtle-border)] transition-[background-color,color,opacity] group-hover:opacity-[var(--vlaina-opacity-100)] hover:bg-[var(--vlaina-color-attachment-remove-bg-hover)] hover:text-[var(--vlaina-color-attachment-remove-fg-hover)]"
                  >
                    <Icon name="common.close" size="xs" />
                  </button>
                </>
              ) : (
                <span
                  className="relative box-border inline-flex items-center gap-1.5 rounded-full bg-[var(--vlaina-sidebar-chat-row-active)] py-1 pl-1.5 pr-6 text-[var(--vlaina-font-15)] leading-6 text-[var(--vlaina-sidebar-row-selected-text)] shadow-[var(--vlaina-shadow-none)] sm:pl-2.5 sm:pr-7"
                  style={{ maxWidth: 'min(16rem, calc(100% - 0.5rem))' }}
                  data-chat-file-attachment-token="true"
                  data-no-focus-input="true"
                >
                  <Icon name="file.attach" size="xs" className="hidden shrink-0 text-[var(--vlaina-sidebar-row-selected-text)] sm:block" />
                  <span className="min-w-0 truncate">{attachment.name || 'attachment'}</span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    data-no-focus-input="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(attachment.id);
                    }}
                    className="absolute right-1.5 top-1/2 z-[var(--vlaina-z-10)] inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-[var(--vlaina-radius-4px)] bg-[var(--vlaina-sidebar-chat-row-active)] text-[var(--vlaina-font-10)] leading-none text-[var(--vlaina-sidebar-row-selected-text)] opacity-[var(--vlaina-opacity-0)] shadow-[var(--vlaina-shadow-selection-soft)] transition-[background-color,opacity] hover:bg-[var(--vlaina-sidebar-chat-row-hover)] focus-visible:opacity-[var(--vlaina-opacity-100)] group-hover:opacity-[var(--vlaina-opacity-100)]"
                  >
                    <Icon name="common.close" size="xs" />
                  </button>
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
