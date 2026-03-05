import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import type { Attachment } from '@/lib/storage/attachmentStorage';

interface ChatAttachmentPreviewListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function ChatAttachmentPreviewList({ attachments, onRemove }: ChatAttachmentPreviewListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-4 pb-0 flex gap-2 overflow-x-auto scrollbar-none">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="relative group shrink-0">
          {attachment.type.startsWith('image/') ? (
            <LocalImage
              src={attachment.previewUrl}
              alt={attachment.name || "preview"}
              className="h-16 w-16 object-cover rounded-xl border border-black/5 dark:border-white/10"
            />
          ) : (
            <div className="h-16 w-16 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-black/5 dark:border-white/10">
              <Icon name="file.attach" size="md" className="text-gray-400" />
            </div>
          )}

          <button
            onClick={() => onRemove(attachment.id)}
            className="absolute -top-1.5 -right-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
          >
            <Icon name="common.close" size="md" />
          </button>
        </div>
      ))}
    </div>
  );
}
