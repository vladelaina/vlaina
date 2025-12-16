/**
 * Progress Module - 进度追踪模块
 * 
 * 提供进度条和计数器的追踪功能
 */

// 页面组件（重新导出）
export { ProgressPage } from '@/components/Progress/ProgressPage';

// Store
export { useProgressStore } from './stores';

// 类型
export type {
  ProgressItem,
  CounterItem,
  ProgressOrCounter,
  CreateProgressInput,
  CreateCounterInput,
} from './types';

// 组件（重新导出）
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
