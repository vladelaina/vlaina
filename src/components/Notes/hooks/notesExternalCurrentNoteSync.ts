import type { MutableRefObject } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { logNotesDebug } from '@/stores/notes/debugLog';

type SyncCurrentNoteFromDisk = ReturnType<typeof useNotesStore.getState>['syncCurrentNoteFromDisk'];
type ApplyExternalPathDeletion = ReturnType<typeof useNotesStore.getState>['applyExternalPathDeletion'];

interface CreateCurrentNoteExternalSyncOptions {
  syncCurrentNoteFromDisk: SyncCurrentNoteFromDisk;
  applyExternalPathDeletion: ApplyExternalPathDeletion;
  lastToastKeyRef: MutableRefObject<string | null>;
}

export function createCurrentNoteExternalSync(options: CreateCurrentNoteExternalSyncOptions) {
  const { syncCurrentNoteFromDisk, applyExternalPathDeletion, lastToastKeyRef } = options;

  const notifyOnce = (key: string, message: string, type: 'warning' | 'info') => {
    if (lastToastKeyRef.current === key) {
      return;
    }

    lastToastKeyRef.current = key;
    useToastStore.getState().addToast(message, type, 5000);
  };

  const notifyCurrentNoteDeletion = (path: string, isDirty: boolean) => {
    if (isDirty) {
      notifyOnce(
        `conflict:${path}`,
        'Current note was deleted outside vlaina while you still have unsaved changes.',
        'warning'
      );
      return;
    }

    notifyOnce(
      `deleted:${path}`,
      'Current note was deleted outside vlaina.',
      'warning'
    );
  };

  const reconcileCurrentNote = async (reconcileOptions?: { force?: boolean }) => {
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
    if (!currentNotePath) {
      return;
    }

    const result = await syncCurrentNoteFromDisk(reconcileOptions);
    if (result !== 'unchanged') {
      logNotesDebug('useNotesExternalSync:reconcileCurrentNote:result', {
        currentNotePath,
        result,
      });
    }
    if (result === 'reloaded') {
      notifyOnce(
        `reloaded:${currentNotePath}`,
        'Current note was updated outside vlaina and has been reloaded.',
        'info'
      );
    } else if (result === 'conflict' || result === 'deleted-conflict') {
      notifyOnce(
        `conflict:${currentNotePath}`,
        'Current note changed outside vlaina while you still have unsaved changes.',
        'warning'
      );
    } else if (result === 'deleted') {
      notifyOnce(
        `deleted:${currentNotePath}`,
        'Current note was deleted outside vlaina.',
        'warning'
      );
    } else if (result === 'unchanged') {
      lastToastKeyRef.current = null;
    }
  };

  const applyExternalDeletion = async (path: string) => {
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
    const isDirty = useNotesStore.getState().isDirty;
    const touchesCurrentNote = Boolean(
      currentNotePath &&
      (currentNotePath === path || currentNotePath.startsWith(`${path}/`))
    );

    logNotesDebug('useNotesExternalSync:applyExternalDeletion:start', {
      path,
      currentNotePath,
      isDirty,
      touchesCurrentNote,
    });

    await applyExternalPathDeletion(path);

    if (touchesCurrentNote) {
      notifyCurrentNoteDeletion(currentNotePath ?? path, isDirty);
    }
  };

  return {
    applyExternalDeletion,
    reconcileCurrentNote,
  };
}
