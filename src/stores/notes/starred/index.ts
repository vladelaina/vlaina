export {
  CURRENT_STARRED_VERSION,
  createStarredEntry,
  dedupeStarredEntries,
  getStarredEntryKey,
  getVaultStarredPaths,
  normalizeStarredEntry,
  remapStarredEntriesForVault,
  type StarredRegistry,
} from './registry';
export {
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
  resolveStarredRelativePathForVault,
} from './pathUtils';
export { flushStarredRegistry, loadStarredRegistry, saveStarredRegistry } from './persistence';
export {
  findStarredEntryByPath,
  loadStarredForVault,
  removeStarredEntryById,
  toggleStarredEntry,
} from './store';
export type { StarredEntry, StarredKind } from '../types';
