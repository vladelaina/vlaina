import { useCallback, useEffect, useRef, useState } from 'react';
import { registerComposerFocusAdapter } from '@/lib/ui/composerFocusRegistry';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;

interface UseChatComposerOptions {
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void;
  attachments: Attachment[];
  getNoteMentions: () => NoteMentionReference[];
  onAfterSend: () => void;
  focusTrigger?: number;
}

export function useChatComposer({
  onSend,
  attachments,
  getNoteMentions,
  onAfterSend,
  focusTrigger,
}: UseChatComposerOptions) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRootRef = useRef<HTMLDivElement>(null);
  const submitAfterCompositionRef = useRef(false);
  const hasExplicitMultilineRef = useRef(false);

  useEffect(() => {
    if (focusTrigger && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [focusTrigger]);

  useEffect(() => {
    const unregister = registerComposerFocusAdapter({
      focus: () => {
        const input = textareaRef.current;
        if (!input) {
          return false;
        }
        input.focus({ preventScroll: true });
        const position = input.value.length;
        input.setSelectionRange(position, position);
        return true;
      },
      blur: () => {
        const input = textareaRef.current;
        if (!input) {
          return false;
        }
        input.blur();
        return document.activeElement !== input;
      },
      isFocused: () => document.activeElement === textareaRef.current,
      containsTarget: (target) => target instanceof Node && !!composerRootRef.current?.contains(target),
      insertText: (text) => {
        const normalized = text
          .replace(INVISIBLE_BREAK_REGEX, '')
          .replace(UNIVERSAL_NEWLINE_REGEX, '\n')
          .trim();
        if (!normalized) {
          return false;
        }

        hasExplicitMultilineRef.current = true;
        setMessage((prev) => {
          const separator = prev && !prev.endsWith('\n') ? '\n' : '';
          return `${prev}${separator}${normalized}`;
        });

        requestAnimationFrame(() => {
          const input = textareaRef.current;
          if (!input) {
            return;
          }
          input.focus({ preventScroll: true });
          const pos = input.value.length;
          input.setSelectionRange(pos, pos);
        });
        return true;
      },
    });

    return unregister;
  }, []);

  usePredictedTextareaHeight(textareaRef, {
    value: message,
    minHeight: 24,
    maxHeight: 320,
  });

  const markExplicitMultiline = useCallback(() => {
    hasExplicitMultilineRef.current = true;
  }, []);

  const handleMessageChange = useCallback((nextValue: string) => {
    setMessage(nextValue);
    if (!nextValue.includes('\n')) {
      hasExplicitMultilineRef.current = false;
    }
  }, []);

  const handleSend = useCallback(
    (overrideMessage?: string) => {
      const noteMentions = getNoteMentions();
      const rawMessage = overrideMessage ?? message;
      const cleanedMessage = rawMessage.replace(INVISIBLE_BREAK_REGEX, '');
      const normalizedMessage = cleanedMessage.replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const outgoingMessage = hasExplicitMultilineRef.current
        ? normalizedMessage
        : normalizedMessage.replace(/\s*\n+\s*/g, '');

      if (!outgoingMessage.trim() && attachments.length === 0 && noteMentions.length === 0) {
        return;
      }

      submitAfterCompositionRef.current = false;
      hasExplicitMultilineRef.current = false;
      onSend(outgoingMessage, attachments, noteMentions);
      setMessage('');
      onAfterSend();

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
    },
    [attachments, getNoteMentions, message, onAfterSend, onSend]
  );

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    if (!submitAfterCompositionRef.current) {
      return;
    }

    submitAfterCompositionRef.current = false;
    requestAnimationFrame(() => {
      handleSend(textareaRef.current?.value ?? message);
    });
  }, [handleSend, message]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const native = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };

      if (e.key === 'Enter' && e.shiftKey) {
        hasExplicitMultilineRef.current = true;
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isComposing || native.isComposing || native.keyCode === 229) {
          submitAfterCompositionRef.current = true;
          return;
        }
        submitAfterCompositionRef.current = false;
        handleSend();
      }
    },
    [handleSend, isComposing]
  );

  return {
    message,
    isComposing,
    textareaRef,
    composerRootRef,
    markExplicitMultiline,
    handleMessageChange,
    handleSend,
    handleKeyDown,
    handleCompositionStart: () => setIsComposing(true),
    handleCompositionEnd,
  };
}
