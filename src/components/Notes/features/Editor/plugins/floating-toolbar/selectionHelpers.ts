export {
  MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES,
  MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES,
  MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS,
} from './selectionHelperConstants';
export {
  getCurrentAlignment,
  getCurrentBlockType,
  isSelectionInFirstH1,
} from './selectionBlockContext';
export {
  getActiveMarks,
  getBgColor,
  getFormattableTextRanges,
  getLinkUrl,
  getTextColor,
} from './selectionMarkContext';
export {
  calculateBottomPosition,
  calculateBottomPositionForRange,
  calculatePosition,
  calculatePositionForRange,
} from './selectionPosition';
export type { TextRange } from './selectionHelperTypes';
