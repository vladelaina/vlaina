import { StateCreator } from 'zustand';
import type { NotesStore } from '../types';
import { createWorkspaceDocumentActions } from './workspaceDocumentActions';
import { createWorkspaceExternalActions } from './workspaceExternalActions';
import { createWorkspaceTabActions } from './workspaceTabActions';
import type { WorkspaceSlice } from './workspaceSliceTypes';
import { createOpenNoteAction } from './workspaceOpenNoteAction';
import { createOpenAbsoluteNoteAction } from './workspaceOpenAbsoluteNoteAction';
import { createWorkspacePrefetchActions } from './workspacePrefetchActions';
import { createWorkspaceAdoptAbsoluteNoteAction } from './workspaceAdoptAbsoluteNoteAction';

export { MAX_PENDING_NOTE_PREFETCHES } from './workspaceOpenNoteSupport';

export const createWorkspaceSlice: StateCreator<NotesStore, [], [], WorkspaceSlice> = (
  set,
  get
) => ({
  currentNote: null,
  currentNoteRevision: 0,
  currentNoteDiskRevision: 0,
  workspaceRestoredNote: null,
  isDirty: false,
  isLoading: false,
  error: null,
  openTabs: [],
  recentlyClosedTabs: [],
  noteNavigationHistory: [],
  noteNavigationHistoryIndex: -1,
  draftNotes: {},
  pendingDraftDiscardPath: null,
  displayNames: new Map(),

  ...createOpenNoteAction(set, get),
  ...createOpenAbsoluteNoteAction(set, get),
  ...createWorkspacePrefetchActions(set, get),
  ...createWorkspaceAdoptAbsoluteNoteAction(set, get),
  ...createWorkspaceDocumentActions(set, get),
  ...createWorkspaceExternalActions(set, get),
  ...createWorkspaceTabActions(set, get),
});
