/**
 * Progress Module
 * 
 * Provides progress bar and counter tracking functionality
 */

// Page Components (re-export)
export { ProgressPage } from '@/components/Progress/ProgressPage';

// Store
export { useProgressStore } from './stores';

// Types
export type {
  ProgressItem,
  CounterItem,
  ProgressOrCounter,
  CreateProgressInput,
  CreateCounterInput,
} from './types';

// Components (re-export)
export {
  ItemCard,
  ActiveItemCard,
  ArchivedItemCard,
  CreateModal,
  DetailModal,
  useDetailModal,
  IconPicker,
  IconSelectionView,
  getIconByName,
  HistoryWaveform,
} from './components';
export type { FocusTarget } from './components';

// Hooks
export { useProgressDrag } from './hooks';
