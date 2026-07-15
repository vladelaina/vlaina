import { useCallback, type RefObject } from 'react';
import { useNoteMentionState } from './useNoteMentionState';
import { findMentionTitlesInValue } from '../noteMentionHelpers';

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
  const syncMentions = useCallback(({ allNoteCandidates, mentions, value }: {
    allNoteCandidates: Array<{ path: string; title: string; kind: 'note' | 'folder' }>;
    mentions: Array<{ path: string; title: string; kind?: 'note' | 'folder' }>;
    value: string;
  }) => {
    if (!value.includes('@')) {
      return [];
    }

    const syncedMentions = new Map<string, { path: string; title: string; kind: 'note' | 'folder' }>();
    const candidatesByPath = new Map<string, { path: string; title: string; kind: 'note' | 'folder' }>();
    for (const candidate of allNoteCandidates) {
      candidatesByPath.set(candidate.path, candidate);
    }

    function* mentionTitles() {
      for (const mention of mentions) {
        yield mention.title;
      }
      for (const candidate of allNoteCandidates) {
        yield candidate.title;
      }
    }

    const matchedTitles = findMentionTitlesInValue(value, mentionTitles());
    const retainedTitles = new Set<string>();
    for (const mention of mentions) {
      if (matchedTitles.has(mention.title)) {
        const candidate = candidatesByPath.get(mention.path);
        syncedMentions.set(mention.path, {
          path: mention.path,
          title: mention.title,
          kind: candidate?.kind ?? (mention.kind === 'folder' ? 'folder' : 'note'),
        });
        retainedTitles.add(mention.title);
      }
    }

    const candidatesByTitle = new Map<string, Array<{ path: string; title: string; kind: 'note' | 'folder' }>>();
    for (const candidate of allNoteCandidates) {
      if (!retainedTitles.has(candidate.title) && matchedTitles.has(candidate.title)) {
        const candidates = candidatesByTitle.get(candidate.title) ?? [];
        candidates.push(candidate);
        candidatesByTitle.set(candidate.title, candidates);
      }
    }

    for (const candidates of candidatesByTitle.values()) {
      if (candidates.length === 1) {
        const candidate = candidates[0];
        syncedMentions.set(candidate.path, {
          path: candidate.path,
          title: candidate.title,
          kind: candidate.kind,
        });
      }
    }

    const result: Array<{ path: string; title: string; kind: 'note' | 'folder' }> = [];
    for (const mention of syncedMentions.values()) {
      result.push(mention);
    }
    return result;
  }, []);

  const {
    mentions,
    hasMentionCandidates,
    clearMentions,
    currentPageCandidates,
    folderCandidates,
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
    appendMentions,
    removeMention,
    restoreMentions,
  } = useNoteMentionState({
    value: message,
    onValueChange: handleMessageChange,
    textareaRef,
    syncMentions,
    removeLastMentionOnBoundary: true,
  });

  return {
    noteMentions: mentions,
    hasMentionCandidates,
    clearNoteMentions: clearMentions,
    currentPageCandidates,
    folderCandidates,
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
    appendNoteMentions: appendMentions,
    restoreNoteMentions: restoreMentions,
    removeNoteMention: removeMention,
  };
}
