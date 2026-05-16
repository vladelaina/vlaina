import { useNotesStore } from '@/stores/notes/useNotesStore';

type SyncCurrentNoteFromDisk = ReturnType<typeof useNotesStore.getState>['syncCurrentNoteFromDisk'];
type ApplyExternalPathDeletion = ReturnType<typeof useNotesStore.getState>['applyExternalPathDeletion'];

interface CreateCurrentNoteExternalSyncOptions {
  syncCurrentNoteFromDisk: SyncCurrentNoteFromDisk;
  applyExternalPathDeletion: ApplyExternalPathDeletion;
}

export function createCurrentNoteExternalSync(options: CreateCurrentNoteExternalSyncOptions) {
  const { syncCurrentNoteFromDisk, applyExternalPathDeletion } = options;
  let reconcileInFlight = false;
  let pendingReconcileOptions: { force?: boolean } | null = null;

  const reconcileCurrentNote = async (reconcileOptions?: { force?: boolean }) => {
    if (reconcileInFlight) {
      pendingReconcileOptions = {
        force: Boolean(pendingReconcileOptions?.force || reconcileOptions?.force),
      };
      return;
    }

    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
    if (!currentNotePath) {
      return;
    }

    reconcileInFlight = true;
    try {
      let nextOptions: { force?: boolean } | undefined = reconcileOptions;
      do {
        pendingReconcileOptions = null;
        await syncCurrentNoteFromDisk(nextOptions);
        nextOptions = pendingReconcileOptions ?? undefined;
      } while (pendingReconcileOptions);
    } finally {
      reconcileInFlight = false;
    }
  };

  const applyExternalDeletion = async (path: string) => {
    await applyExternalPathDeletion(path);
  };

  return {
    applyExternalDeletion,
    reconcileCurrentNote,
  };
}
