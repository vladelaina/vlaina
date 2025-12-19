/**
 * Storage Module - Unified storage architecture
 * 
 * Core concept: There is only one type of "item" (UnifiedTask)
 * 
 * Storage locations:
 * - .nekotick/data.json (data source)
 * - nekotick.md (human-readable backup)
 */

// Main exports
export {
  loadUnifiedData,
  saveUnifiedData,
  saveUnifiedDataImmediate,
  type UnifiedData,
  type UnifiedTask,
  type UnifiedGroup,
  type UnifiedProgress,
  type UnifiedArchiveSection,
  type UnifiedArchiveEntry,
} from './unifiedStorage';

// Path utilities
export {
  getBasePath,
  getPaths,
  ensureDirectories,
} from './paths';
