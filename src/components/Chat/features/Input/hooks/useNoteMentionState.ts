import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  buildMentionPreviewParts,
  collectNotePaths,
  getNoteMentionTrigger,
  insertMentionAtTrigger,
  type MentionPreviewPart,
  type NoteMentionCandidate,
} from '../noteMentionHelpers';

type SyncMentionsContext = {
  allNoteCandidates: NoteMentionCandidate[];
  mentions: NoteMentionReference[];
  value: string;
};

interface UseNoteMentionStateOptions {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  syncMentions: (context: SyncMentionsContext) => NoteMentionReference[];
  removeLastMentionOnBoundary?: boolean;
}

export function useNoteMentionState({
  value,
  onValueChange,
  textareaRef,
  syncMentions,
  removeLastMentionOnBoundary = false,
}: UseNoteMentionStateOptions) {
  const notesRootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesLoading = useNotesStore((state) => state.isLoading);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);

  const [mentions, setMentions] = useState<NoteMentionReference[]>([]);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [textareaScrollTop, setTextareaScrollTop] = useState(0);

  const allNoteCandidates = useMemo<NoteMentionCandidate[]>(() => {
    if (!notesRootFolder) {
      return [];
    }

    const paths: string[] = [];
    collectNotePaths(notesRootFolder.children, paths);
    const uniquePaths = Array.from(new Set(paths));

    return uniquePaths
      .map((path) => ({
        path,
        title: getDisplayName(path),
        isCurrent: path === currentNotePath,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [currentNotePath, getDisplayName, notesRootFolder]);

  const mentionTrigger = useMemo(
    () => getNoteMentionTrigger(value, caretIndex),
    [caretIndex, value],
  );

  const filteredCandidates = useMemo(() => {
    if (!mentionTrigger) {
      return [];
    }

    const query = mentionTrigger.query.trim().toLowerCase();
    const candidates = allNoteCandidates.filter((candidate) => {
      if (!query) {
        return true;
      }

      return (
        candidate.title.toLowerCase().includes(query)
        || candidate.path.toLowerCase().includes(query)
      );
    });

    return candidates
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) {
          return a.isCurrent ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, 30);
  }, [allNoteCandidates, mentionTrigger]);

  const currentPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => candidate.isCurrent),
    [filteredCandidates],
  );

  const linkedPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => !candidate.isCurrent),
    [filteredCandidates],
  );

  const showMentionPicker = !!mentionTrigger && filteredCandidates.length > 0;

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionTrigger?.query, mentionTrigger?.start]);

  useEffect(() => {
    if (!mentionTrigger || mentionTrigger.start < 0) {
      return;
    }
    if (notesRootFolder || !notesPath || notesLoading) {
      return;
    }
    void loadFileTree();
  }, [loadFileTree, mentionTrigger, notesLoading, notesPath, notesRootFolder]);

  useEffect(() => {
    setMentions((prev) => syncMentions({
      allNoteCandidates,
      mentions: prev,
      value,
    }));
  }, [allNoteCandidates, syncMentions, value]);

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const handleValueChange = useCallback((nextValue: string, nextCaretIndex?: number) => {
    onValueChange(nextValue);
    if (typeof nextCaretIndex === 'number') {
      setCaretIndex(nextCaretIndex);
    }
  }, [onValueChange]);

  const handleCaretChange = useCallback((nextCaretIndex: number) => {
    setCaretIndex(nextCaretIndex);
  }, []);

  const handleCaretBlur = useCallback(() => {
    setCaretIndex(-1);
  }, []);

  const removeMention = useCallback(
    (path: string, rangeStart?: number) => {
      const target = mentions.find((mention) => mention.path === path);
      if (!target) {
        return;
      }

      const label = `@${target.title}`;
      const index = typeof rangeStart === 'number' ? rangeStart : value.indexOf(label);
      if (index < 0) {
        setMentions((prev) => prev.filter((mention) => mention.path !== path));
        return;
      }

      const nextValue = `${value.slice(0, index)}${value.slice(index + label.length)}`;
      onValueChange(nextValue);
      setCaretIndex(index);
      setMentions((prev) => prev.filter((mention) => mention.path !== path));

      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(index, index);
      });
    },
    [mentions, onValueChange, textareaRef, value],
  );

  const applyMentionCandidate = useCallback(
    (candidate: NoteMentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }

      const { nextValue, nextCaret } = insertMentionAtTrigger(value, mentionTrigger, candidate.title);
      onValueChange(nextValue);
      setCaretIndex(-1);
      setMentions((prev) => {
        if (prev.some((mention) => mention.path === candidate.path)) {
          return prev;
        }
        return [...prev, { path: candidate.path, title: candidate.title }];
      });

      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [mentionTrigger, onValueChange, textareaRef, value],
  );

  const mentionPreviewParts = useMemo<MentionPreviewPart[]>(
    () => buildMentionPreviewParts(value, mentions),
    [mentions, value],
  );

  const handleMentionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const selectionStart = event.currentTarget.selectionStart ?? 0;
      const selectionEnd = event.currentTarget.selectionEnd ?? 0;
      const mentionRanges = mentionPreviewParts.filter(
        (part): part is MentionPreviewPart & { mention: NoteMentionReference } =>
          part.type === 'mention' && !!part.mention,
      );

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          const overlapped = mentionRanges.find(
            (part) => selectionStart < part.end && selectionEnd > part.start,
          );
          if (overlapped) {
            event.preventDefault();
            removeMention(overlapped.mention.path, overlapped.start);
            return true;
          }
        }

        const targetPart = mentionRanges.find((part) =>
          event.key === 'Backspace'
            ? selectionStart > part.start && selectionStart <= part.end
            : selectionStart >= part.start && selectionStart < part.end,
        );
        if (targetPart) {
          event.preventDefault();
          removeMention(targetPart.mention.path, targetPart.start);
          return true;
        }
      }

      if (
        removeLastMentionOnBoundary &&
        event.key === 'Backspace' &&
        mentions.length > 0 &&
        selectionStart === 0 &&
        selectionEnd === 0
      ) {
        event.preventDefault();
        const lastMention = mentions[mentions.length - 1];
        if (lastMention) {
          removeMention(lastMention.path);
        }
        return true;
      }

      if (!showMentionPicker) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMentionIndex((prev) => (prev + 1) % filteredCandidates.length);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMentionIndex((prev) =>
          prev - 1 < 0 ? filteredCandidates.length - 1 : prev - 1,
        );
        return true;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const candidate = filteredCandidates[activeMentionIndex] ?? filteredCandidates[0];
        if (candidate) {
          applyMentionCandidate(candidate);
          return true;
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setCaretIndex(-1);
        return true;
      }

      return false;
    },
    [
      activeMentionIndex,
      applyMentionCandidate,
      filteredCandidates,
      mentionPreviewParts,
      mentions,
      removeLastMentionOnBoundary,
      removeMention,
      showMentionPicker,
    ],
  );

  return {
    mentions,
    clearMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    activeCandidatePath: filteredCandidates[activeMentionIndex]?.path ?? null,
    textareaScrollTop,
    handleValueChange,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    removeMention,
  };
}
