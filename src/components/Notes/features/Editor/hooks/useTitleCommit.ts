import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { getInvalidFileNameReason } from '@/stores/notes/noteUtils';
import { useNotesStore } from '@/stores/useNotesStore';
import { registerCurrentTitleCommitter } from '../utils/titleCommitRegistry';

interface TitleCommitOptions {
  strict?: boolean;
}

export function useTitleCommit({
  initialTitle,
  isComposingRef,
  notePath,
  setNotesPreviewTitle,
  setTitle,
  showInvalidFileNameToast,
  title,
}: {
  initialTitle: string;
  isComposingRef: React.RefObject<boolean>;
  notePath: string;
  setNotesPreviewTitle: (path: string | null, title: string | null) => void;
  setTitle: Dispatch<SetStateAction<string>>;
  showInvalidFileNameToast: (message: string) => void;
  title: string;
}) {
  const renameNote = useNotesStore((state) => state.renameNote);
  const renameAbsoluteNote = useNotesStore((state) => state.renameAbsoluteNote);
  const updateDraftNoteName = useNotesStore((state) => state.updateDraftNoteName);
  const saveNote = useNotesStore((state) => state.saveNote);
  const isCommittingRef = useRef(false);
  const commitInFlightRef = useRef<Promise<void> | null>(null);
  const commitTitleRef = useRef<(options?: TitleCommitOptions) => Promise<void>>(async () => undefined);

  const commitTitleIfNeeded = useCallback(async (options: TitleCommitOptions = {}) => {
    if (isComposingRef.current) return;
    const assertStrictCommitSucceeded = () => {
      if (!options.strict) return;
      const state = useNotesStore.getState();
      if (isDraftNotePath(notePath)) {
        if (
          state.currentNote?.path === notePath &&
          state.saveErrorPath === notePath &&
          state.saveError
        ) {
          throw new Error(state.saveError);
        }
        return;
      }
      if (state.currentNote?.path === notePath) {
        throw new Error(state.error ?? 'Failed to rename note');
      }
    };
    if (commitInFlightRef.current) {
      await commitInFlightRef.current;
      assertStrictCommitSucceeded();
      return;
    }

    const trimmed = title.trim();
    if (!trimmed && !isDraftNotePath(notePath)) {
      setTitle('');
      setNotesPreviewTitle(null, null);
      return;
    }
    if (trimmed === initialTitle) {
      setNotesPreviewTitle(null, null);
      return;
    }

    const invalidReason = trimmed ? getInvalidFileNameReason(trimmed) : null;
    if (invalidReason) {
      showInvalidFileNameToast(invalidReason);
      return;
    }

    isCommittingRef.current = true;
    const commit = (async () => {
      if (isDraftNotePath(notePath)) {
        updateDraftNoteName(notePath, trimmed);
        if (useNotesStore.getState().notesPath) {
          await saveNote(options.strict
            ? { explicit: false, throwOnError: true }
            : { explicit: false });
        }
        setTitle(trimmed ? resolveDraftNoteTitle(trimmed) : '');
        return;
      }

      if (isAbsolutePath(notePath)) await renameAbsoluteNote(notePath, trimmed);
      else await renameNote(notePath, trimmed);
    })();
    commitInFlightRef.current = commit;
    try {
      await commit;
      assertStrictCommitSucceeded();
    } finally {
      if (commitInFlightRef.current === commit) commitInFlightRef.current = null;
      isCommittingRef.current = false;
      setNotesPreviewTitle(null, null);
    }
  }, [
    initialTitle,
    isComposingRef,
    notePath,
    renameAbsoluteNote,
    renameNote,
    saveNote,
    setNotesPreviewTitle,
    setTitle,
    showInvalidFileNameToast,
    title,
    updateDraftNoteName,
  ]);

  commitTitleRef.current = commitTitleIfNeeded;
  useEffect(() => (
    registerCurrentTitleCommitter(() => commitTitleRef.current({ strict: true }))
  ), []);

  return { commitTitleIfNeeded, isCommittingRef };
}
