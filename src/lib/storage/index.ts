/**
 * Storage Module - Unified storage architecture
 * 
 * Core concept: All tasks and events are stored as NekoEvents (ICS)
 * 
 * Storage locations:
 * - .nekotick/calendars/*.ics (Events & Tasks)
 * - .nekotick/store/data.json (Settings & Progress)
 */

export {
  loadUnifiedData,
  saveUnifiedData,
  saveUnifiedDataImmediate,
  type UnifiedData,
  type UnifiedProgress,
} from './unifiedStorage';

// Path utilities
export {
  getBasePath,
  getPaths,
  ensureDirectories,
} from './paths';
