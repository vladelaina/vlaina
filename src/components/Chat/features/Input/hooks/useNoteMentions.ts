import { useCallback, type RefObject } from 'react';
import { useNoteMentionState } from './useNoteMentionState';

interface UseNoteMentionsOptions {
  message: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  handleMessageChange: (message: string) => void;
}

export function useNoteMentions({
  message,
  textareaRef,
  handleMessageChange,
}: UseNoteMentionsOptions) {
  const syncMentions = useCallback(({ mentions, value }: {
    mentions: Array<{ path: string; title: string }>;
    value: string;
  }) => {
    return mentions.filter((mention) => value.includes(`@${mention.title}`));
  }, []);

  const {
    mentions,
    clearMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
    activeCandidatePath,
    textareaScrollTop,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    removeMention,
  } = useNoteMentionState({
    value: message,
    onValueChange: handleMessageChange,
    textareaRef,
    syncMentions,
    removeLastMentionOnBoundary: true,
  });

  return {
    noteMentions: mentions,
    clearNoteMentions: clearMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
    activeCandidatePath,
    textareaScrollTop,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    removeNoteMention: removeMention,
  };
}
