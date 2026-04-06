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
  const notesRootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesLoading = useNotesStore((state) => state.isLoading);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);

  const [noteMentions, setNoteMentions] = useState<NoteMentionReference[]>([]);
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
    () => getNoteMentionTrigger(message, caretIndex),
    [message, caretIndex]
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
        candidate.title.toLowerCase().includes(query) ||
        candidate.path.toLowerCase().includes(query)
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
    [filteredCandidates]
  );

  const linkedPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => !candidate.isCurrent),
    [filteredCandidates]
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
    setNoteMentions((prev) =>
      prev.filter((mention) => message.includes(`@${mention.title}`))
    );
  }, [message]);

  const clearNoteMentions = useCallback(() => {
    setNoteMentions([]);
  }, []);

  const handleCaretChange = useCallback((nextCaretIndex: number) => {
    setCaretIndex(nextCaretIndex);
  }, []);

  const handleCaretBlur = useCallback(() => {
    setCaretIndex(-1);
  }, []);

  const removeNoteMention = useCallback(
    (path: string, rangeStart?: number) => {
      const target = noteMentions.find((mention) => mention.path === path);
      if (target) {
        const label = `@${target.title}`;
        const index = typeof rangeStart === 'number' ? rangeStart : message.indexOf(label);
        const nextMessage =
          index >= 0
            ? `${message.slice(0, index)}${message.slice(index + label.length)}`
            : message;
        handleMessageChange(nextMessage);
        setCaretIndex(index >= 0 ? index : Math.min(caretIndex, nextMessage.length));
      }

      setNoteMentions((prev) => prev.filter((mention) => mention.path !== path));
    },
    [caretIndex, handleMessageChange, message, noteMentions]
  );

  const applyMentionCandidate = useCallback(
    (candidate: NoteMentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }

      const { nextValue: nextMessage, nextCaret } = insertMentionAtTrigger(
        message,
        mentionTrigger,
        candidate.title
      );

      setNoteMentions((prev) => {
        if (prev.some((mention) => mention.path === candidate.path)) {
          return prev;
        }
        return [...prev, { path: candidate.path, title: candidate.title }];
      });

      handleMessageChange(nextMessage);
      setCaretIndex(-1);

      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [handleMessageChange, mentionTrigger, message, textareaRef]
  );

  const mentionPreviewParts = useMemo<MentionPreviewPart[]>(
    () => buildMentionPreviewParts(message, noteMentions),
    [message, noteMentions]
  );

  const handleMentionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const selectionStart = event.currentTarget.selectionStart ?? 0;
      const selectionEnd = event.currentTarget.selectionEnd ?? 0;
      const mentionRanges = mentionPreviewParts.filter(
        (part): part is MentionPreviewPart & { mention: NoteMentionReference } =>
          part.type === 'mention' && !!part.mention
      );

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          const overlapped = mentionRanges.filter(
            (part) => selectionStart < part.end && selectionEnd > part.start
          );
          if (overlapped.length > 0) {
            event.preventDefault();
            const part = overlapped[0];
            removeNoteMention(part.mention.path, part.start);
            return true;
          }
        }

        const targetPart = mentionRanges.find((part) =>
          event.key === 'Backspace'
            ? selectionStart > part.start && selectionStart <= part.end
            : selectionStart >= part.start && selectionStart < part.end
        );
        if (targetPart) {
          event.preventDefault();
          removeNoteMention(targetPart.mention.path, targetPart.start);
          return true;
        }
      }

      if (
        event.key === 'Backspace' &&
        noteMentions.length > 0 &&
        selectionStart === 0 &&
        selectionEnd === 0
      ) {
        event.preventDefault();
        const lastMention = noteMentions[noteMentions.length - 1];
        if (lastMention) {
          removeNoteMention(lastMention.path);
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
          prev - 1 < 0 ? filteredCandidates.length - 1 : prev - 1
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
      noteMentions,
      removeNoteMention,
      showMentionPicker,
    ]
  );

  return {
    noteMentions,
    clearNoteMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    activeCandidatePath: filteredCandidates[activeMentionIndex]?.path ?? null,
    textareaScrollTop,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    removeNoteMention,
  };
}
