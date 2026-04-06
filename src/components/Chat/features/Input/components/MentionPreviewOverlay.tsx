import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { MentionPreviewPart } from '../noteMentionHelpers';

interface MentionPreviewOverlayProps {
  mentionPreviewParts: MentionPreviewPart[];
  textareaScrollTop: number;
  onRemoveMention: (path: string) => void;
}

export function MentionPreviewOverlay({
  mentionPreviewParts,
  textareaScrollTop,
  onRemoveMention,
}: MentionPreviewOverlayProps) {
  if (mentionPreviewParts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 whitespace-pre-wrap break-words text-[15px] leading-6"
      style={{ transform: `translateY(${-textareaScrollTop}px)` }}
      aria-hidden="true"
    >
      {mentionPreviewParts.map((part) => {
        if (part.type !== 'mention' || !part.mention) {
          return (
            <span key={part.key} className="text-transparent">
              {part.text}
            </span>
          );
        }

        return (
          <MentionPreviewToken
            key={part.key}
            part={{ ...part, mention: part.mention }}
            onRemoveMention={onRemoveMention}
          />
        );
      })}
    </div>
  );
}

function MentionPreviewToken({
  part,
  onRemoveMention,
}: {
  part: MentionPreviewPart & { mention: NoteMentionReference };
  onRemoveMention: (path: string) => void;
}) {
  return (
    <span
      className="pointer-events-auto group relative inline rounded-md bg-blue-500/90 text-white dark:bg-blue-500/80"
      data-no-focus-input="true"
    >
      {part.text}
      <button
        type="button"
        className="absolute -right-1 -top-1 z-10 rounded-full bg-blue-500/95 px-1 text-[10px] leading-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onRemoveMention(part.mention.path)}
      >
        ×
      </button>
    </span>
  );
}
