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
      <div className="px-4 pt-4 pb-0 flex gap-2 overflow-x-auto scrollbar-none">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="relative group shrink-0">
            {attachment.type.startsWith('image/') ? (
              <LocalImage
                src={attachment.previewUrl}
                alt={attachment.name || "preview"}
                className="h-16 w-16 object-cover rounded-xl border border-[var(--vlaina-color-subtle-border)] transition-opacity hover:opacity-[var(--vlaina-opacity-90)]"
                onClick={() => setActiveImageId(attachment.id)}
              />
            ) : (
              <div className="h-16 w-16 bg-[var(--vlaina-color-attachment-surface)] rounded-xl flex items-center justify-center border border-[var(--vlaina-color-subtle-border)]">
                <Icon name="file.attach" size="md" className="text-[var(--vlaina-color-muted-icon)]" />
              </div>
            )}

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
          </div>
        ))}
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
