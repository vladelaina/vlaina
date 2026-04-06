import type {
  ChangeEvent,
  ClipboardEvent,
  CompositionEvent,
  KeyboardEvent,
  MouseEvent,
  RefObject,
} from 'react';
import { cn } from '@/lib/utils';
import {
  chatComposerInputBlockClass,
  chatComposerTextareaClass,
} from '../composerStyles';
import type { MentionPreviewPart } from '../noteMentionHelpers';
import { MentionPreviewOverlay } from './MentionPreviewOverlay';

interface ChatComposerFieldProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  placeholder: string;
  textareaScrollTop: number;
  mentionPreviewParts: MentionPreviewPart[];
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onCompositionStart: (event: CompositionEvent<HTMLTextAreaElement>) => void;
  onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onClick: (event: MouseEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (event: React.UIEvent<HTMLTextAreaElement>) => void;
  onRemoveMention: (path: string) => void;
}

export function ChatComposerField({
  textareaRef,
  message,
  placeholder,
  textareaScrollTop,
  mentionPreviewParts,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  onKeyDown,
  onSelect,
  onClick,
  onBlur,
  onPaste,
  onScroll,
  onRemoveMention,
}: ChatComposerFieldProps) {
  return (
    <div className={chatComposerInputBlockClass}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={onChange}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          onClick={onClick}
          onBlur={onBlur}
          onPaste={onPaste}
          onScroll={onScroll}
          placeholder={placeholder}
          rows={1}
          className={cn(chatComposerTextareaClass, 'relative z-10 w-full')}
        />
        <MentionPreviewOverlay
          mentionPreviewParts={mentionPreviewParts}
          textareaScrollTop={textareaScrollTop}
          onRemoveMention={onRemoveMention}
        />
      </div>
    </div>
  );
}
