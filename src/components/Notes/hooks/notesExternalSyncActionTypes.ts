import type { MutableRefObject } from 'react';
import type { useNotesStore } from '@/stores/notes/useNotesStore';
import type { PendingRenameEntry } from './notesExternalRenameQueue';

type NotesState = ReturnType<typeof useNotesStore.getState>;

export const PENDING_RENAME_TTL_MS = 180;
export const MAX_PENDING_EXTERNAL_PATH_EVENTS = 2048;
export const MAX_EXTERNAL_WATCH_EVENT_PATHS = 4096;

export type SyncCurrentNoteFromDisk = NotesState['syncCurrentNoteFromDisk'];

export interface PendingCreateEntry {
  newPath: string;
  expiresAt: number;
  kind?: string | null;
}

export interface CreateNotesExternalSyncActionsOptions {
  notesPath: string;
  loadFileTree: NotesState['loadFileTree'];
  invalidateNoteCache: NotesState['invalidateNoteCache'];
  syncCurrentNoteFromDisk: SyncCurrentNoteFromDisk;
  applyExternalPathRename: NotesState['applyExternalPathRename'];
  applyExternalPathDeletion: NotesState['applyExternalPathDeletion'];
  reloadTimerRef: MutableRefObject<number | null>;
  pendingRenameTimerRef: MutableRefObject<number | null>;
  pendingRenamesRef: MutableRefObject<PendingRenameEntry[]>;
  pendingCreatesRef: MutableRefObject<PendingCreateEntry[]>;
  reconcileInFlightRef: MutableRefObject<boolean>;
}
