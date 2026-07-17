export {
  CURRENT_NOTES_ROOT_KEY,
  MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES,
  NOTES_ROOTS_STORAGE_KEY,
} from './notesRootStoreConstants';
export {
  loadFromStorage,
  saveToStorage,
} from './notesRootLocalStorage';
export {
  loadPersistedNotesRootState,
  persistNotesRootState,
} from './notesRootPersistence';
export {
  getNotesRootName,
  isNativeFilesystemPath,
  isOversizedRecentNotesRootsStorageValue,
  normalizeNotesRootInfo,
  normalizeRecentNotesRoots,
  parseRecentNotesRootsStorageValue,
  resolveRenamedNotesRootPath,
  tryParseRecentNotesRootsStorageValue,
  upsertRecentNotesRoot,
} from './notesRootInfoUtils';
export {
  initializeWindowLabel,
  parseNotesRootBroadcastMessage,
  queryNotesRootOpenInOtherWindow,
  setWindowNotesRootPath,
  setupBroadcastChannel,
} from './notesRootBroadcast';
export {
  closeCurrentNotesRootAction,
  removeRecentNotesRootAction,
  syncCurrentNotesRootExternalPathAction,
} from './notesRootActions';

export function waitForUiRelease() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 80);
  });
}
