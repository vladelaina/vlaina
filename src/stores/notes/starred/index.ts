export {
  CURRENT_STARRED_VERSION,
  createStarredEntry,
  createStarredEntryIfValid,
  dedupeStarredEntries,
  getStarredEntryKey,
  getNotesRootStarredPaths,
  normalizeStarredEntry,
  remapStarredEntriesForNotesRoot,
  type StarredRegistry,
} from './registry';
export {
  createStarredEntryFromAbsoluteNotePath,
  findStarredEntryByPath,
  getStarredEntryAbsolutePath,
  getStarredNoteDisplayPath,
  isStarredEntryForPath,
  resolveStarredNoteContext,
  type StarredNoteContext,
} from './entryPaths';
export {
  getStarredNotesRootPathComparisonKey,
  isPathInsideStarredNotesRoot,
  isSameStarredNotesRootPath,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
  resolveStarredRelativePathForNotesRoot,
} from './pathUtils';
export { flushStarredRegistry, loadStarredRegistry, saveStarredRegistry } from './persistence';
export {
  loadStarredForNotesRoot,
  removeStarredEntryById,
  toggleStarredEntry,
} from './store';
export type { StarredEntry, StarredKind } from '../types';
