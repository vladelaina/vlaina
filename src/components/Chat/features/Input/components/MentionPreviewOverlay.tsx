import type { ReactNode } from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { MentionPreviewPart } from '../noteMentionHelpers';

interface MentionPreviewOverlayProps {
  mentionPreviewParts: MentionPreviewPart[];
  textareaScrollTop: number;
  onFocusMentionEnd: (rangeEnd: number) => void;
  onRemoveMention: (path: string, rangeStart?: number, rangeEnd?: number) => void;
}

export function MentionPreviewOverlay({
  mentionPreviewParts,
  textareaScrollTop,
  onFocusMentionEnd,
  onRemoveMention,
}: MentionPreviewOverlayProps) {
  if (mentionPreviewParts.length === 0) {
    return null;
  }

  const renderedParts: ReactNode[] = [];
  for (let index = 0; index < mentionPreviewParts.length; index += 1) {
    const part = mentionPreviewParts[index];
    if (!part) {
      continue;
    }

    if (part.type !== 'mention' || !part.mention) {
      renderedParts.push(
        <span key={part.key} className="text-transparent">
          {part.text}
        </span>
      );
      continue;
    }

    const nextPart = mentionPreviewParts[index + 1];
    const nextNonSpacePart = mentionPreviewParts[index + 2];
    const hasTrailingSpace = nextPart?.type === 'text' && nextPart.text.startsWith(' ');
    const consumeTrailingSpace = hasTrailingSpace && (
      nextPart.text.length > 1 || nextNonSpacePart?.type !== 'mention'
    );
    renderedParts.push(
      <MentionPreviewToken
        key={part.key}
        part={{ ...part, mention: part.mention }}
        hasTrailingSpace={hasTrailingSpace}
        consumeTrailingSpace={consumeTrailingSpace}
        onFocusMentionEnd={onFocusMentionEnd}
        onRemoveMention={onRemoveMention}
      />
    );

    if (!consumeTrailingSpace || !nextPart) {
      continue;
    }

    const remainingText = nextPart.text.slice(1);
    if (remainingText.length > 0) {
      renderedParts.push(
        <span key={`${nextPart.key}-rest`} className="text-transparent">
          {remainingText}
        </span>
      );
    }
    index += 1;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[var(--vlaina-z-20)] whitespace-pre-wrap break-words text-[var(--vlaina-font-15)] leading-6"
      style={{ transform: `translateY(${-textareaScrollTop}px)` }}
      aria-hidden="true"
    >
      {renderedParts}
    </div>
  );
}

function MentionPreviewToken({
  part,
  hasTrailingSpace,
  consumeTrailingSpace,
  onFocusMentionEnd,
  onRemoveMention,
}: {
  part: MentionPreviewPart & { mention: NoteMentionReference };
  hasTrailingSpace: boolean;
  consumeTrailingSpace: boolean;
  onFocusMentionEnd: (rangeEnd: number) => void;
  onRemoveMention: (path: string, rangeStart?: number, rangeEnd?: number) => void;
}) {
  const boundaryEnd = hasTrailingSpace ? part.end + 1 : part.end;

  return (
    <span
      className="pointer-events-auto group relative inline-flex items-center align-baseline text-[var(--vlaina-font-15)] leading-6 text-[var(--vlaina-sidebar-row-selected-text)]"
      data-mention-preview-token="true"
      data-no-focus-input="true"
      onMouseDown={(event) => {
        event.preventDefault();
        onFocusMentionEnd(boundaryEnd);
      }}
    >
      <span
        className="pointer-events-none absolute -bottom-0.5 left-0 right-0 top-0.5 rounded-full bg-[var(--vlaina-sidebar-chat-row-active)] shadow-[var(--vlaina-shadow-none)]"
        data-mention-preview-token-surface="true"
      />
      <span className="relative">{part.text}</span>
      {consumeTrailingSpace && (
        <span className="relative text-transparent" aria-hidden="true">
          {' '}
        </span>
      )}
      <button
        type="button"
        className="absolute -right-1 -top-1 z-[var(--vlaina-z-10)] inline-flex size-4 items-center justify-center rounded-[var(--vlaina-radius-4px)] bg-[var(--vlaina-sidebar-chat-row-active)] text-[var(--vlaina-font-10)] leading-none text-[var(--vlaina-sidebar-row-selected-text)] opacity-[var(--vlaina-opacity-0)] shadow-[var(--vlaina-shadow-selection-soft)] transition-[background-color,opacity] hover:bg-[var(--vlaina-sidebar-chat-row-hover)] group-hover:opacity-[var(--vlaina-opacity-100)]"
        data-mention-preview-remove="true"
        data-no-focus-input="true"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={() => onRemoveMention(part.mention.path, part.start, boundaryEnd)}
      >
        ×
      </button>
    </span>
  );
}
