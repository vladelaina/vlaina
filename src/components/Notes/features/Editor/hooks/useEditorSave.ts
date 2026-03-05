import { useRef, useCallback, useEffect } from 'react';
import { createPersistenceQueue, type PersistenceQueue } from '@/lib/storage/persistenceEngine';

const SAVE_DEBOUNCE_MS = 800;
const SAVE_MAX_WAIT_MS = 2500;

export function useEditorSave(saveNote: () => Promise<void>) {
  const saveNoteRef = useRef(saveNote);
  const saveQueueRef = useRef<PersistenceQueue<number> | null>(null);
  const saveSequenceRef = useRef(0);

  saveNoteRef.current = saveNote;

  if (!saveQueueRef.current) {
    saveQueueRef.current = createPersistenceQueue<number>({
      debounceMs: SAVE_DEBOUNCE_MS,
      maxWaitMs: SAVE_MAX_WAIT_MS,
      write: async () => {
        await saveNoteRef.current();
      },
    });
  }

  const flushSave = useCallback(() => {
    void saveQueueRef.current?.flush();
  }, []);

  const debouncedSave = useCallback(() => {
    saveSequenceRef.current += 1;
    saveQueueRef.current?.schedule(saveSequenceRef.current);
  }, []);

  useEffect(() => {
    return () => {
      void saveQueueRef.current?.flush();
    };
  }, []);

  return { debouncedSave, flushSave };
}
