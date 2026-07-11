import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  MAX_NOTE_MENTION_SCAN_ITEMS,
  type NoteMentionReference,
} from '@/lib/ai/noteMentions';
import { focusVisibleTextareaAt } from '@/lib/ui/composerFocusRegistry';
import {
  buildMentionPreviewParts,
  insertMentionAtTrigger,
  type NoteMentionCandidate,
} from '../noteMentionHelpers';
import {
  getMentionBoundaryEnd,
  handleNoteMentionKeyDown,
  isMentionPreviewRange,
} from './noteMentionKeyboard';
import {
  normalizeMentionReferencesForState,
  normalizeMentionTitle,
} from './noteMentionStateNormalize';
import type { UseNoteMentionStateOptions } from './noteMentionStateTypes';
import { useNoteMentionCandidates } from './useNoteMentionCandidates';

export function useNoteMentionState({
  value,
  onValueChange,
  textareaRef,
  syncMentions,
  removeLastMentionOnBoundary = false,
}: UseNoteMentionStateOptions) {
  const [mentions, setMentions] = useState<NoteMentionReference[]>([]);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [textareaScrollTop, setTextareaScrollTop] = useState(0);
  const {
    allNoteCandidates,
    currentPageCandidates,
    filteredCandidates,
    folderCandidates,
    linkedPageCandidates,
    mentionPickerStatus,
    mentionTrigger,
    showMentionPicker,
  } = useNoteMentionCandidates(value, caretIndex);
  const mentionPreviewParts = useMemo(
    () => buildMentionPreviewParts(value, mentions),
    [mentions, value],
  );
  const mentionRanges = useMemo(
    () => mentionPreviewParts.filter(isMentionPreviewRange),
    [mentionPreviewParts],
  );

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionTrigger?.query, mentionTrigger?.start]);

  useEffect(() => {
    setMentions((prev) => {
      const next = normalizeMentionReferencesForState(syncMentions({
        allNoteCandidates,
        mentions: prev,
        value,
      }), false);
      if (
        next.length === prev.length &&
        next.every((mention, index) =>
          mention.path === prev[index]?.path &&
          mention.title === prev[index]?.title &&
          mention.kind === prev[index]?.kind
        )
      ) {
        return prev;
      }
      return next;
    });
  }, [allNoteCandidates, syncMentions, value]);

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const restoreMentions = useCallback((nextMentions: NoteMentionReference[]) => {
    setMentions(normalizeMentionReferencesForState(nextMentions, true));
  }, []);

  const setTextareaCaretIndex = useCallback((nextCaretIndex: number) => {
    setCaretIndex(nextCaretIndex);
    const input = textareaRef.current;
    if (!input) {
      return;
    }

    if (!focusVisibleTextareaAt(input, nextCaretIndex)) {
      input.setSelectionRange(nextCaretIndex, nextCaretIndex);
    }
  }, [textareaRef]);

  const getAtomicMentionCaretIndex = useCallback(
    (nextCaretIndex: number) => {
      const target = mentionRanges.find((part) =>
        nextCaretIndex > part.start && nextCaretIndex < getMentionBoundaryEnd(value, part)
      );
      return target ? getMentionBoundaryEnd(value, target) : nextCaretIndex;
    },
    [mentionRanges, value],
  );

  const handleValueChange = useCallback((nextValue: string, nextCaretIndex?: number) => {
    onValueChange(nextValue);
    if (typeof nextCaretIndex === 'number') {
      setTextareaCaretIndex(nextCaretIndex);
    }
  }, [onValueChange, setTextareaCaretIndex]);

  const handleCaretChange = useCallback((nextCaretIndex: number, nextSelectionEnd = nextCaretIndex) => {
    if (nextCaretIndex !== nextSelectionEnd) {
      setCaretIndex(-1);
      return;
    }

    setTextareaCaretIndex(getAtomicMentionCaretIndex(nextCaretIndex));
  }, [getAtomicMentionCaretIndex, setTextareaCaretIndex]);

  const handleCaretBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (typeof document !== 'undefined' && !document.hasFocus()) {
        return;
      }

      setCaretIndex(-1);
    });
  }, []);

  const removeMention = useCallback(
    (path: string, rangeStart?: number, rangeEnd?: number) => {
      const target = mentions.find((mention) => mention.path === path);
      if (!target) {
        return;
      }

      const label = `@${target.title}`;
      const index = typeof rangeStart === 'number' ? rangeStart : value.indexOf(label);
      const end = typeof rangeEnd === 'number' ? rangeEnd : index + label.length;
      if (index < 0) {
        setMentions((prev) => prev.filter((mention) => mention.path !== path));
        return;
      }

      const nextValue = `${value.slice(0, index)}${value.slice(end)}`;
      onValueChange(nextValue);
      setCaretIndex(index);
      setMentions((prev) => prev.filter((mention) => mention.path !== path));

      requestAnimationFrame(() => {
        focusVisibleTextareaAt(textareaRef.current, index);
      });
    },
    [mentions, onValueChange, textareaRef, value],
  );

  const deleteSelectionRange = useCallback(
    (selectionStart: number, selectionEnd: number, overlappedMentions: NoteMentionReference[]) => {
      const nextValue = `${value.slice(0, selectionStart)}${value.slice(selectionEnd)}`;
      const overlappedPaths = new Set(overlappedMentions.map((mention) => mention.path));

      onValueChange(nextValue);
      setCaretIndex(selectionStart);
      setMentions((prev) => prev.filter((mention) => !overlappedPaths.has(mention.path)));

      requestAnimationFrame(() => {
        focusVisibleTextareaAt(textareaRef.current, selectionStart);
      });
    },
    [onValueChange, textareaRef, value],
  );

  const appendMentions = useCallback(
    (nextMentions: NoteMentionReference[]) => {
      const validMentions = normalizeMentionReferencesForState(nextMentions, true);
      if (validMentions.length === 0) {
        return;
      }

      const existingPaths = new Set(mentions.map((mention) => mention.path));
      const remainingMentionSlots = Math.max(0, MAX_NOTE_MENTION_SCAN_ITEMS - mentions.length);
      const uniqueMentions = validMentions
        .filter((mention) => !existingPaths.has(mention.path))
        .slice(0, remainingMentionSlots);
      if (uniqueMentions.length === 0) {
        return;
      }

      const insertion = uniqueMentions
        .map((mention) => `@${mention.title}`)
        .join(' ');
      const prefix = value.length === 0 || /\s$/.test(value) ? '' : ' ';
      const suffix = insertion ? ' ' : '';
      const nextValue = insertion ? `${value}${prefix}${insertion}${suffix}` : value;
      const nextCaret = nextValue.length;

      onValueChange(nextValue);
      setCaretIndex(nextCaret);
      setMentions((prev) => [...prev, ...uniqueMentions].slice(0, MAX_NOTE_MENTION_SCAN_ITEMS));

      requestAnimationFrame(() => {
        focusVisibleTextareaAt(textareaRef.current, nextCaret);
      });
    },
    [mentions, onValueChange, textareaRef, value],
  );

  const applyMentionCandidate = useCallback(
    (candidate: NoteMentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }

      const title = normalizeMentionTitle(candidate.title, candidate.path);
      const { nextValue, nextCaret } = insertMentionAtTrigger(value, mentionTrigger, title);
      onValueChange(nextValue);
      setCaretIndex(-1);
      setMentions((prev) => {
        if (prev.some((mention) => mention.path === candidate.path)) {
          return prev;
        }
        if (prev.length >= MAX_NOTE_MENTION_SCAN_ITEMS) {
          return prev;
        }
        return [...prev, { path: candidate.path, title, kind: candidate.kind }];
      });

      requestAnimationFrame(() => {
        focusVisibleTextareaAt(textareaRef.current, nextCaret);
      });
    },
    [mentionTrigger, onValueChange, textareaRef, value],
  );

  const handleMentionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => handleNoteMentionKeyDown({
      activeMentionIndex,
      applyMentionCandidate,
      deleteSelectionRange,
      event,
      filteredCandidates,
      mentionRanges,
      mentions,
      removeLastMentionOnBoundary,
      removeMention,
      setActiveMentionIndex,
      setCaretIndex,
      setTextareaCaretIndex,
      showMentionPicker,
      value,
    }),
    [
      activeMentionIndex,
      applyMentionCandidate,
      deleteSelectionRange,
      filteredCandidates,
      mentionRanges,
      mentions,
      removeLastMentionOnBoundary,
      removeMention,
      setTextareaCaretIndex,
      showMentionPicker,
      value,
    ],
  );

  return {
    mentions,
    hasMentionCandidates: allNoteCandidates.length > 0,
    clearMentions,
    restoreMentions,
    currentPageCandidates,
    folderCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
    activeCandidatePath: filteredCandidates[activeMentionIndex]?.path ?? null,
    textareaScrollTop,
    handleValueChange,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    appendMentions,
    removeMention,
  };
}
