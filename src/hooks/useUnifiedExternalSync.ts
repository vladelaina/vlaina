import { useEffect, useMemo, useRef } from 'react';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { reloadSessionMessagesFromDisk } from '@/stores/ai/sessionConsistency';
import { setUnifiedStorageAutoSyncTrigger } from '@/lib/storage/unifiedStorage';
import { setChatStorageAutoSyncTrigger } from '@/lib/storage/chatStorage';
import {
  emitStorageAutoSyncEvent,
  subscribeStorageAutoSync,
  type StorageAutoSyncEvent,
} from '@/lib/storage/storageAutoSync';

const RELOAD_DEBOUNCE_MS = 220;

export function useUnifiedExternalSync() {
  const loaded = useUnifiedStore((state) => state.loaded);
  const reloadFromDisk = useUnifiedStore((state) => state.reloadFromDisk);
  const temporaryChatEnabled = useAIUIStore((state) => state.temporaryChatEnabled);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const generatingSessions = useAIUIStore((state) => state.generatingSessions);

  const hasActiveGeneration = useMemo(
    () => Object.values(generatingSessions).some(Boolean),
    [generatingSessions],
  );

  const reloadTimerRef = useRef<number | null>(null);
  const reloadInFlightRef = useRef(false);
  const canReloadUnifiedRef = useRef(false);
  const canReloadSessionMessagesRef = useRef(false);
  const pendingUnifiedReloadRef = useRef(false);
  const pendingSessionReloadIdsRef = useRef(new Set<string>());

  useEffect(() => {
    canReloadUnifiedRef.current = loaded;
    canReloadSessionMessagesRef.current = loaded && !temporaryChatEnabled && !hasActiveGeneration;
  }, [hasActiveGeneration, loaded, temporaryChatEnabled]);

  useEffect(() => {
    const triggerUnifiedSync = () => {
      emitStorageAutoSyncEvent({ kind: 'unified' });
    };
    const triggerChatSessionSync = (sessionId?: string) => {
      emitStorageAutoSyncEvent({ kind: 'chat-session', sessionId });
    };

    setUnifiedStorageAutoSyncTrigger(triggerUnifiedSync);
    setChatStorageAutoSyncTrigger(triggerChatSessionSync);

    return () => {
      setUnifiedStorageAutoSyncTrigger(null);
      setChatStorageAutoSyncTrigger(null);
    };
  }, []);

  useEffect(() => {
    const hasPendingReloads = () =>
      pendingUnifiedReloadRef.current || pendingSessionReloadIdsRef.current.size > 0;

    const hasRunnableReloads = () =>
      (pendingUnifiedReloadRef.current && canReloadUnifiedRef.current) ||
      (pendingSessionReloadIdsRef.current.size > 0 && canReloadSessionMessagesRef.current);

    const shouldReloadSession = (sessionId: string) => {
      return useAIUIStore.getState().currentSessionId === sessionId;
    };

    const invalidateCachedSession = (sessionId: string) => {
      const store = useUnifiedStore.getState();
      const ai = store.data.ai;
      if (!ai || !(sessionId in ai.messages)) {
        return;
      }

      const nextMessages = { ...ai.messages };
      delete nextMessages[sessionId];
      store.updateAIData({ messages: nextMessages }, true);
    };

    const runReload = async () => {
      if (!hasRunnableReloads()) {
        return;
      }

      if (reloadInFlightRef.current) {
        return;
      }

      reloadInFlightRef.current = true;

      const shouldReloadUnified = pendingUnifiedReloadRef.current && canReloadUnifiedRef.current;
      const pendingSessionIds = new Set(pendingSessionReloadIdsRef.current);
      if (shouldReloadUnified) {
        pendingUnifiedReloadRef.current = false;
      }
      if (canReloadSessionMessagesRef.current) {
        pendingSessionReloadIdsRef.current.clear();
      }

      try {
        if (shouldReloadUnified) {
          await reloadFromDisk();
          const activeSessionId = useAIUIStore.getState().currentSessionId;
          if (activeSessionId) {
            pendingSessionIds.add(activeSessionId);
          }
        }

        if (canReloadSessionMessagesRef.current) {
          for (const sessionId of pendingSessionIds) {
            if (!shouldReloadSession(sessionId)) {
              continue;
            }

            await reloadSessionMessagesFromDisk(sessionId);
          }
        } else {
          pendingSessionIds.forEach((sessionId) => {
            pendingSessionReloadIdsRef.current.add(sessionId);
          });
        }
      } finally {
        reloadInFlightRef.current = false;
        if (hasRunnableReloads()) {
          scheduleReload();
        }
      }
    };

    const scheduleReload = () => {
      if (!hasPendingReloads()) {
        return;
      }

      if (!hasRunnableReloads()) {
        return;
      }

      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void runReload();
      }, RELOAD_DEBOUNCE_MS);
    };

    const queueReload = (event: StorageAutoSyncEvent) => {
      if (event.kind === 'ui-preferences') {
        useUIStore.getState().reloadPreferencesFromStorage();
        return;
      }

      if (event.kind === 'notes-starred') {
        const notesState = useNotesStore.getState();
        void notesState.loadStarred(notesState.notesPath ?? '');
        return;
      }

      if (event.kind === 'chat-session' && event.sessionId) {
        if (!shouldReloadSession(event.sessionId)) {
          invalidateCachedSession(event.sessionId);
          return;
        }
        pendingSessionReloadIdsRef.current.add(event.sessionId);
      } else {
        pendingUnifiedReloadRef.current = true;
      }

      scheduleReload();
    };

    const unsubscribe = subscribeStorageAutoSync(queueReload);

    if (hasPendingReloads() && hasRunnableReloads()) {
      scheduleReload();
    }

    return () => {
      unsubscribe();
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [currentSessionId, hasActiveGeneration, loaded, reloadFromDisk, temporaryChatEnabled]);
}
