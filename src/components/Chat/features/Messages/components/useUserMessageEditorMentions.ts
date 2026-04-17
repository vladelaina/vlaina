import {
  useCallback,
  type RefObject,
} from 'react';
import { useNoteMentionState } from '@/components/Chat/features/Input/hooks/useNoteMentionState';

interface UseUserMessageEditorMentionsOptions {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function useUserMessageEditorMentions({
  value,
  onValueChange,
  textareaRef,
}: UseUserMessageEditorMentionsOptions) {
  const syncMentions = useCallback(({ allNoteCandidates, value }: {
    allNoteCandidates: Array<{ path: string; title: string; isCurrent: boolean }>;
    value: string;
  }) => {
    return allNoteCandidates
      .filter((candidate) => value.includes(`@${candidate.title}`))
      .map((candidate) => ({ path: candidate.path, title: candidate.title }));
  }, []);

  const {
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    activeCandidatePath,
    textareaScrollTop,
    handleValueChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    handleCaretChange,
    applyMentionCandidate,
    removeMention,
  } = useNoteMentionState({
    value,
    onValueChange,
    textareaRef,
    syncMentions,
  });

  return {
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    activeCandidatePath,
    textareaScrollTop,
    handleValueChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    setCaretIndex: handleCaretChange,
    applyMentionCandidate,
    removeMention,
  };
}
