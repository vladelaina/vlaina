import { useEffect, useMemo, useRef } from 'react';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { setUnifiedStorageAutoSyncTrigger } from '@/lib/storage/unifiedStorage';
import { setChatStorageAutoSyncTrigger } from '@/lib/storage/chatStorage';
import {
  emitStorageAutoSyncEvent,
  subscribeStorageAutoSync,
} from '@/lib/storage/storageAutoSync';

const RELOAD_DEBOUNCE_MS = 220;

export function useUnifiedExternalSync() {
  const loaded = useUnifiedStore((state) => state.loaded);
  const reloadFromDisk = useUnifiedStore((state) => state.reloadFromDisk);
  const temporaryChatEnabled = useUnifiedStore((state) => !!state.data.ai?.temporaryChatEnabled);
  const generatingSessions = useAIUIStore((state) => state.generatingSessions);

  const hasActiveGeneration = useMemo(
    () => Object.values(generatingSessions).some(Boolean),
    [generatingSessions],
  );

  const reloadTimerRef = useRef<number | null>(null);
  const reloadInFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const canReloadRef = useRef(false);

  useEffect(() => {
    canReloadRef.current = loaded && !temporaryChatEnabled && !hasActiveGeneration;
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
    const runReload = async () => {
      if (!canReloadRef.current) {
        pendingReloadRef.current = true;
        return;
      }

      if (reloadInFlightRef.current) {
        pendingReloadRef.current = true;
        return;
      }

      reloadInFlightRef.current = true;
      try {
        await reloadFromDisk();
      } finally {
        reloadInFlightRef.current = false;
        if (pendingReloadRef.current && canReloadRef.current) {
          pendingReloadRef.current = false;
          if (reloadTimerRef.current !== null) {
            window.clearTimeout(reloadTimerRef.current);
          }
          reloadTimerRef.current = window.setTimeout(() => {
            reloadTimerRef.current = null;
            void runReload();
          }, RELOAD_DEBOUNCE_MS);
        }
      }
    };

    const scheduleReload = () => {
      pendingReloadRef.current = true;

      if (!canReloadRef.current) {
        return;
      }

      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        pendingReloadRef.current = false;
        void runReload();
      }, RELOAD_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeStorageAutoSync(() => {
      scheduleReload();
    });

    if (pendingReloadRef.current && canReloadRef.current) {
      scheduleReload();
    }

    return () => {
      unsubscribe();
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [reloadFromDisk]);

  useEffect(() => {
    if (!canReloadRef.current || !pendingReloadRef.current) {
      return;
    }

    if (reloadTimerRef.current !== null) {
      return;
    }

    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      pendingReloadRef.current = false;
      void reloadFromDisk();
    }, RELOAD_DEBOUNCE_MS);

    return () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [hasActiveGeneration, loaded, reloadFromDisk, temporaryChatEnabled]);
}
