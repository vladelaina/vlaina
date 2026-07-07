import { useEffect, useMemo, useRef } from 'react';
import { isPotentiallyLoadableNoteMentionReference } from '@/lib/ai/noteMentions';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { getCurrentNotesRootPath, setCurrentNotesRootPath } from '@/stores/notes/storage';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
} from '@/stores/notes/starred';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import {
  collectMentionCandidates,
  getNoteMentionTrigger,
  type NoteMentionCandidate,
} from '../noteMentionHelpers';
import type { IndexedNoteMentionCandidate } from './noteMentionStateTypes';

const MAX_VISIBLE_NOTE_MENTION_CANDIDATES = 30;
const MAX_VISIBLE_FOLDER_MENTION_CANDIDATES = 12;

export function useNoteMentionCandidates(value: string, caretIndex: number) {
  const notesRootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesLoading = useNotesStore((state) => state.isLoading);
  const starredEntries = useNotesStore((state) => state.starredEntries);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);
  const getNoteIcon = useNotesStore((state) => state.getNoteIcon);
  const activeNotesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
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
      if (seenPaths.has(candidate.path)) continue;

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
      if (entry.kind !== 'note' && entry.kind !== 'folder') continue;

      const entryNotesRootPath = normalizeStarredNotesRootPath(entry.notesRootPath);
      const isCurrentNotesRootEntry = !!currentNotesRootPath && entryNotesRootPath === currentNotesRootPath;
      const relativePath = normalizeStarredRelativePath(entry.relativePath);
      if (!relativePath) continue;

      const path = isCurrentNotesRootEntry
        ? relativePath
        : getStarredEntryAbsolutePath({ ...entry, relativePath });
      if (
        !path ||
        !isPotentiallyLoadableNoteMentionReference({ path }, entry.kind) ||
        seenPaths.has(path)
      ) {
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
    if (!mentionTrigger) return [];

    const query = mentionTrigger.query.trim().toLowerCase();
    const currentNoteCandidates: IndexedNoteMentionCandidate[] = [];
    const folderCandidates: IndexedNoteMentionCandidate[] = [];
    const linkedNoteCandidates: IndexedNoteMentionCandidate[] = [];

    for (const candidate of allNoteCandidates) {
      if (query && !candidate.lowerTitle.includes(query) && !candidate.lowerPath.includes(query)) {
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

  useEffect(() => {
    if (!mentionTrigger || mentionTrigger.start < 0) {
      requestedTreeLoadTriggerRef.current = null;
      return;
    }
    if (notesRootFolder || notesLoading || !effectiveNotesRootPath) return;
    if (!mentionTriggerKey || requestedTreeLoadTriggerRef.current === mentionTriggerKey) return;
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

  return {
    allNoteCandidates,
    currentPageCandidates: filteredCandidates.filter((candidate) => candidate.isCurrent),
    filteredCandidates,
    folderCandidates: filteredCandidates.filter((candidate) => candidate.kind === 'folder'),
    linkedPageCandidates: filteredCandidates.filter((candidate) => candidate.kind === 'note' && !candidate.isCurrent),
    mentionPickerStatus,
    mentionTrigger,
    showMentionPicker,
  };
}
