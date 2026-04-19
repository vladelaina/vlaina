import { useRef, useCallback, useEffect } from 'react';
import { createPersistenceQueue, type PersistenceQueue } from '@/lib/storage/persistenceEngine';
import { useNotesStore } from '@/stores/useNotesStore';
import { logNotesDebug } from '@/stores/notes/debugLog';

const SAVE_DEBOUNCE_MS = 800;
const SAVE_MAX_WAIT_MS = 2500;

export function useEditorSave(saveNote: (options?: { explicit?: boolean }) => Promise<void>) {
  const saveNoteRef = useRef(saveNote);
  const saveQueueRef = useRef<PersistenceQueue<number> | null>(null);
  const saveSequenceRef = useRef(0);

  saveNoteRef.current = saveNote;

  const getDebugSnapshot = () => {
    const state = useNotesStore.getState();
    return {
      currentNotePath: state.currentNote?.path ?? null,
      isDirty: state.isDirty,
    };
  };

  if (!saveQueueRef.current) {
    saveQueueRef.current = createPersistenceQueue<number>({
      debounceMs: SAVE_DEBOUNCE_MS,
      maxWaitMs: SAVE_MAX_WAIT_MS,
      write: async () => {
        logNotesDebug('useEditorSave:queue-write', getDebugSnapshot());
        await saveNoteRef.current({ explicit: false });
      },
    });
  }

  const flushSave = useCallback((explicit = false) => {
    if (explicit) {
      void saveNoteRef.current({ explicit: true });
      return;
    }

    void saveQueueRef.current?.flush();
  }, []);

  const debouncedSave = useCallback(() => {
    saveSequenceRef.current += 1;
    logNotesDebug('useEditorSave:debounced-schedule', {
      sequence: saveSequenceRef.current,
      ...getDebugSnapshot(),
    });
    saveQueueRef.current?.schedule(saveSequenceRef.current);
  }, []);

  useEffect(() => {
    return () => {
      saveQueueRef.current?.cancel();
    };
  }, []);

  return { debouncedSave, flushSave };
}
