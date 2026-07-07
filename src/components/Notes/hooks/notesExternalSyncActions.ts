import { createNotesExternalReconcileHandlers } from './notesExternalReconcileHandlers';
import {
  createNotesExternalSyncContext,
  type NotesExternalSyncContext,
} from './notesExternalSyncContext';
import {
  createNotesExternalWatchHandlers,
} from './notesExternalWatchHandlers';
import {
  MAX_EXTERNAL_WATCH_EVENT_PATHS,
  MAX_PENDING_EXTERNAL_PATH_EVENTS,
  type CreateNotesExternalSyncActionsOptions,
  type PendingCreateEntry,
} from './notesExternalSyncActionTypes';

export {
  MAX_EXTERNAL_WATCH_EVENT_PATHS,
  MAX_PENDING_EXTERNAL_PATH_EVENTS,
  type PendingCreateEntry,
};

export function createNotesExternalSyncActions(options: CreateNotesExternalSyncActionsOptions) {
  const context: NotesExternalSyncContext = createNotesExternalSyncContext(options);
  const reconcileHandlers = createNotesExternalReconcileHandlers(context);
  const watchHandlers = createNotesExternalWatchHandlers(context, reconcileHandlers);

  return {
    clearTimers: watchHandlers.clearTimers,
    handleExternalPathRename: watchHandlers.handleExternalPathRename,
    handleWatchEvent: watchHandlers.handleWatchEvent,
    runPollingReconcile: reconcileHandlers.runPollingReconcile,
  };
}
