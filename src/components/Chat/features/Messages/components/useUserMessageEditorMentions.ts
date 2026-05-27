import {
  useCallback,
  type RefObject,
} from 'react';
import { useNoteMentionState } from '@/components/Chat/features/Input/hooks/useNoteMentionState';
import { valueContainsMentionLabel } from '@/components/Chat/features/Input/noteMentionHelpers';

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
    allNoteCandidates: Array<{ path: string; title: string; kind: 'note' | 'folder'; isCurrent: boolean }>;
    value: string;
  }) => {
    const candidatesByTitle = new Map<string, typeof allNoteCandidates>();
    for (const candidate of allNoteCandidates) {
      if (!valueContainsMentionLabel(value, candidate.title)) {
        continue;
      }
      const candidates = candidatesByTitle.get(candidate.title) ?? [];
      candidates.push(candidate);
      candidatesByTitle.set(candidate.title, candidates);
    }

    return Array.from(candidatesByTitle.values())
      .filter((candidates) => candidates.length === 1)
      .map(([candidate]) => ({ path: candidate.path, title: candidate.title, kind: candidate.kind }));
  }, []);

  const {
    currentPageCandidates,
    folderCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
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
    folderCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
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
