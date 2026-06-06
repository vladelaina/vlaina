import {
  useCallback,
  type RefObject,
} from 'react';
import { useNoteMentionState } from '@/components/Chat/features/Input/hooks/useNoteMentionState';
import { findMentionTitlesInValue } from '@/components/Chat/features/Input/noteMentionHelpers';

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
    const matchedTitles = findMentionTitlesInValue(value, (function* () {
      for (const candidate of allNoteCandidates) {
        yield candidate.title;
      }
    })());
    const candidatesByTitle = new Map<string, typeof allNoteCandidates>();
    for (const candidate of allNoteCandidates) {
      if (!matchedTitles.has(candidate.title)) {
        continue;
      }
      const candidates = candidatesByTitle.get(candidate.title) ?? [];
      candidates.push(candidate);
      candidatesByTitle.set(candidate.title, candidates);
    }

    const syncedMentions: Array<{ path: string; title: string; kind: 'note' | 'folder' }> = [];
    for (const candidates of candidatesByTitle.values()) {
      if (candidates.length !== 1) continue;

      const candidate = candidates[0];
      syncedMentions.push({ path: candidate.path, title: candidate.title, kind: candidate.kind });
    }
    return syncedMentions;
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
