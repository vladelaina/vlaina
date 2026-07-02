import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import {
  MAX_NOTE_MENTION_PATH_CHARS,
  MAX_NOTE_MENTION_SCAN_ITEMS,
  MAX_NOTE_MENTION_TITLE_CHARS,
  MAX_NOTE_MENTION_TITLE_RAW_CHARS,
  isPotentiallyLoadableNoteMentionReference,
  type NoteMentionReference,
} from '@/lib/ai/noteMentions';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { getCurrentNotesRootPath, setCurrentNotesRootPath } from '@/stores/notes/storage';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
} from '@/stores/notes/starred';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { focusVisibleTextareaAt } from '@/lib/ui/composerFocusRegistry';
import {
  buildMentionPreviewParts,
  collectMentionCandidates,
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

type IndexedNoteMentionCandidate = NoteMentionCandidate & {
  lowerTitle: string;
  lowerPath: string;
};

type MentionPreviewRange = MentionPreviewPart & { mention: NoteMentionReference };

const MAX_VISIBLE_NOTE_MENTION_CANDIDATES = 30;
const MAX_VISIBLE_FOLDER_MENTION_CANDIDATES = 12;

function isMentionPreviewRange(part: MentionPreviewPart): part is MentionPreviewRange {
  return part.type === 'mention' && !!part.mention;
}

function getMentionBoundaryEnd(value: string, part: MentionPreviewRange): number {
  return value[part.end] === ' ' ? part.end + 1 : part.end;
}

function normalizeMentionText(value: unknown, maxRawChars: number): string {
  return typeof value === 'string' && value.length <= maxRawChars ? value.trim() : '';
}

function normalizeMentionPath(value: unknown): string {
  return normalizeMentionText(value, MAX_NOTE_MENTION_PATH_CHARS);
}

function normalizeMentionKind(value: unknown): NonNullable<NoteMentionReference['kind']> {
  return value === 'folder' ? 'folder' : 'note';
}

function normalizeOptionalMentionKind(value: unknown): NoteMentionReference['kind'] | undefined {
  return value === 'folder' || value === 'note' ? value : undefined;
}

function normalizeMentionTitle(value: unknown, fallback: string): string {
  return (
    normalizeMentionText(value, MAX_NOTE_MENTION_TITLE_RAW_CHARS) || fallback
  ).slice(0, MAX_NOTE_MENTION_TITLE_CHARS);
}

function normalizeMentionReferenceForState(
  mention: Partial<NoteMentionReference> | null | undefined,
  defaultKind: boolean,
): NoteMentionReference | null {
  const path = normalizeMentionPath(mention?.path);
  if (!path) {
    return null;
  }

  const kind = defaultKind
    ? normalizeMentionKind(mention?.kind)
    : normalizeOptionalMentionKind(mention?.kind);
  if (!isPotentiallyLoadableNoteMentionReference({ path }, kind)) {
    return null;
  }

  const title = normalizeMentionTitle(mention?.title, path);
  if (!title) {
    return null;
  }

  return kind ? { path, title, kind } : { path, title };
}

function normalizeMentionReferencesForState(
  nextMentions: readonly NoteMentionReference[],
  defaultKind: boolean,
): NoteMentionReference[] {
  const seenPaths = new Set<string>();
  const normalizedMentions: NoteMentionReference[] = [];
  const scanLimit = Math.min(nextMentions.length, MAX_NOTE_MENTION_SCAN_ITEMS);

  for (let index = 0; index < scanLimit; index += 1) {
    const mention = normalizeMentionReferenceForState(nextMentions[index], defaultKind);
    if (!mention || seenPaths.has(mention.path)) {
      continue;
    }
    seenPaths.add(mention.path);
    normalizedMentions.push(mention);
    if (normalizedMentions.length >= MAX_NOTE_MENTION_SCAN_ITEMS) {
      break;
    }
  }

  return normalizedMentions;
}

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
  const starredEntries = useNotesStore((state) => state.starredEntries);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);
  const getNoteIcon = useNotesStore((state) => state.getNoteIcon);
  const activeNotesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);

  const [mentions, setMentions] = useState<NoteMentionReference[]>([]);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [textareaScrollTop, setTextareaScrollTop] = useState(0);
  const requestedTreeLoadTriggerRef = useRef<string | null>(null);

  const allNoteCandidates = useMemo<IndexedNoteMentionCandidate[]>(() => {
    const treeCandidates: NoteMentionCandidate[] = [];
    if (notesRootFolder) {
      collectMentionCandidates(notesRootFolder.children, treeCandidates);
    }

    const currentNotesRootPath = notesPath || activeNotesRootPath
      ? normalizeStarredNotesRootPath(notesPath || activeNotesRootPath || '')
      : '';
    const candidates: NoteMentionCandidate[] = [];
    const seenPaths = new Set<string>();
    for (const candidate of treeCandidates) {
      if (seenPaths.has(candidate.path)) {
        continue;
      }

      seenPaths.add(candidate.path);
      if (candidate.kind === 'folder') {
        candidates.push(candidate);
        continue;
      }

      candidates.push({
        ...candidate,
        title: getDisplayName(candidate.path),
        isCurrent: candidate.path === currentNotePath,
        icon: getNoteIcon(candidate.path),
      });
    }

    for (const entry of starredEntries) {
      if (entry.kind !== 'note' && entry.kind !== 'folder') {
        continue;
      }

      const entryNotesRootPath = normalizeStarredNotesRootPath(entry.notesRootPath);
      const isCurrentNotesRootEntry = !!currentNotesRootPath && entryNotesRootPath === currentNotesRootPath;
      const relativePath = normalizeStarredRelativePath(entry.relativePath);
      if (!relativePath) {
        continue;
      }
      const path = isCurrentNotesRootEntry
        ? relativePath
        : getStarredEntryAbsolutePath({ ...entry, relativePath });
      if (!path) {
        continue;
      }
      if (!isPotentiallyLoadableNoteMentionReference({ path }, entry.kind)) {
        continue;
      }
      if (seenPaths.has(path)) {
        continue;
      }

      seenPaths.add(path);
      candidates.push({
        path,
        title: entry.kind === 'folder'
          ? `${relativePath.split('/').filter(Boolean).pop() ?? relativePath}/`
          : isCurrentNotesRootEntry
            ? getDisplayName(relativePath)
            : getNoteTitleFromPath(relativePath),
        kind: entry.kind,
        isCurrent: path === currentNotePath,
        icon: entry.kind === 'note' && isCurrentNotesRootEntry ? getNoteIcon(relativePath) : undefined,
        notePath: entry.kind === 'note' ? relativePath : undefined,
        notesRootPath: entryNotesRootPath,
        starredEntry: isCurrentNotesRootEntry ? undefined : entry,
      });
    }

    return candidates
      .map((candidate) => ({
        ...candidate,
        lowerTitle: candidate.title.toLowerCase(),
        lowerPath: candidate.path.toLowerCase(),
      }))
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) {
          return a.isCurrent ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
  }, [activeNotesRootPath, currentNotePath, getDisplayName, getNoteIcon, notesPath, notesRootFolder, starredEntries]);

  const mentionTrigger = useMemo(
    () => getNoteMentionTrigger(value, caretIndex),
    [caretIndex, value],
  );

  const filteredCandidates = useMemo(() => {
    if (!mentionTrigger) {
      return [];
    }

    const query = mentionTrigger.query.trim().toLowerCase();
    const currentNoteCandidates: IndexedNoteMentionCandidate[] = [];
    const folderCandidates: IndexedNoteMentionCandidate[] = [];
    const linkedNoteCandidates: IndexedNoteMentionCandidate[] = [];

    for (const candidate of allNoteCandidates) {
      if (!query) {
        // Continue to bucket selection below.
      } else if (
        !candidate.lowerTitle.includes(query)
        && !candidate.lowerPath.includes(query)
      ) {
        continue;
      }

      if (candidate.kind === 'folder') {
        if (folderCandidates.length < MAX_VISIBLE_FOLDER_MENTION_CANDIDATES) {
          folderCandidates.push(candidate);
        }
      } else if (candidate.isCurrent) {
        if (currentNoteCandidates.length < MAX_VISIBLE_NOTE_MENTION_CANDIDATES) {
          currentNoteCandidates.push(candidate);
        }
      } else if (
        currentNoteCandidates.length + linkedNoteCandidates.length <
        MAX_VISIBLE_NOTE_MENTION_CANDIDATES
      ) {
        linkedNoteCandidates.push(candidate);
      }

      if (
        currentNoteCandidates.length + linkedNoteCandidates.length >= MAX_VISIBLE_NOTE_MENTION_CANDIDATES &&
        folderCandidates.length >= MAX_VISIBLE_FOLDER_MENTION_CANDIDATES
      ) {
        break;
      }
    }

    return [...currentNoteCandidates, ...linkedNoteCandidates, ...folderCandidates];
  }, [allNoteCandidates, mentionTrigger]);

  const currentPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => candidate.isCurrent),
    [filteredCandidates],
  );

  const linkedPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => candidate.kind === 'note' && !candidate.isCurrent),
    [filteredCandidates],
  );

  const folderCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => candidate.kind === 'folder'),
    [filteredCandidates],
  );

  const mentionTriggerKey = mentionTrigger
    ? `${mentionTrigger.start}:${mentionTrigger.query}`
    : null;
  const effectiveNotesRootPath = notesPath || activeNotesRootPath || getCurrentNotesRootPath() || '';
  const mentionQuery = mentionTrigger?.query.trim() ?? '';
  const mentionPickerStatus: 'loading' | 'empty' | null = mentionTrigger && filteredCandidates.length === 0
    ? (notesRootFolder
        ? (mentionQuery ? 'empty' : null)
        : !effectiveNotesRootPath
          ? (mentionQuery ? 'empty' : null)
        : notesLoading || requestedTreeLoadTriggerRef.current !== mentionTriggerKey
          ? 'loading'
          : mentionQuery ? 'empty' : null)
    : null;
  const showMentionPicker = !!mentionTrigger && (
    filteredCandidates.length > 0
    || mentionPickerStatus === 'loading'
  );
  const mentionPreviewParts = useMemo<MentionPreviewPart[]>(
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
    if (!mentionTrigger || mentionTrigger.start < 0) {
      requestedTreeLoadTriggerRef.current = null;
      return;
    }
    if (notesRootFolder || notesLoading) {
      return;
    }
    if (!effectiveNotesRootPath) {
      return;
    }
    if (!mentionTriggerKey || requestedTreeLoadTriggerRef.current === mentionTriggerKey) {
      return;
    }
    if (getCurrentNotesRootPath() !== effectiveNotesRootPath) {
      setCurrentNotesRootPath(effectiveNotesRootPath);
    }
    requestedTreeLoadTriggerRef.current = mentionTriggerKey;
    try {
      void Promise.resolve(loadFileTree()).catch(() => undefined);
    } catch {
      // Keep mention loading best-effort; the store can retry on the next trigger.
    }
  }, [effectiveNotesRootPath, loadFileTree, mentionTrigger, mentionTriggerKey, notesLoading, notesRootFolder]);

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
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const selectionStart = event.currentTarget.selectionStart ?? 0;
      const selectionEnd = event.currentTarget.selectionEnd ?? 0;

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          const overlapped = mentionRanges.filter(
            (part) => selectionStart < part.end && selectionEnd > part.start,
          );
          if (overlapped.length > 0) {
            event.preventDefault();
            deleteSelectionRange(
              selectionStart,
              selectionEnd,
              overlapped.map((part) => part.mention),
            );
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
          removeMention(
            targetPart.mention.path,
            targetPart.start,
            getMentionBoundaryEnd(value, targetPart),
          );
          return true;
        }

        if (event.key === 'Backspace') {
          const trailingSpacePart = mentionRanges.find((part) =>
            selectionStart === part.end + 1
            && selectionEnd === selectionStart
            && value[part.end] === ' ',
          );
          if (trailingSpacePart) {
            event.preventDefault();
            removeMention(
              trailingSpacePart.mention.path,
              trailingSpacePart.start,
              trailingSpacePart.end + 1,
            );
            return true;
          }
        }
      }

      const isPlainHorizontalArrow =
        !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

      if (isPlainHorizontalArrow && selectionStart === selectionEnd && event.key === 'ArrowLeft') {
        const targetPart = mentionRanges.find((part) =>
          selectionStart > part.start && selectionStart <= getMentionBoundaryEnd(value, part)
        );
        if (targetPart) {
          event.preventDefault();
          setTextareaCaretIndex(targetPart.start);
          return true;
        }
      }

      if (isPlainHorizontalArrow && selectionStart === selectionEnd && event.key === 'ArrowRight') {
        const targetPart = mentionRanges.find((part) =>
          selectionStart >= part.start && selectionStart < getMentionBoundaryEnd(value, part)
        );
        if (targetPart) {
          event.preventDefault();
          setTextareaCaretIndex(getMentionBoundaryEnd(value, targetPart));
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

      if (event.key === 'Escape') {
        event.preventDefault();
        setCaretIndex(-1);
        return true;
      }

      if (filteredCandidates.length === 0) {
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

      return false;
    },
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
