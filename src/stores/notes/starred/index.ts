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
export { normalizeStarredRelativePath, normalizeStarredVaultPath } from './pathUtils';
export { flushStarredRegistry, loadStarredRegistry, saveStarredRegistry } from './persistence';
export { loadStarredForVault, removeStarredEntryById, toggleStarredEntry } from './store';
export type { StarredEntry, StarredKind } from '../types';
