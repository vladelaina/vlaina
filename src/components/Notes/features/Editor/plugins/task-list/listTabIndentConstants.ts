import { PluginKey } from '@milkdown/kit/prose/state';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

export const listTabIndentPluginKey = new PluginKey('listTabIndent');
export const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';
export const LIST_GAP_PLACEHOLDER_CLASS = 'editor-list-gap-placeholder-item';
export const LIST_GAP_PLACEHOLDER_TASK_LIST_CLASS = 'editor-list-gap-placeholder-task-list';
export const MAX_LIST_GAP_PLACEHOLDER_DECORATIONS = 1000;
export const MAX_ORDERED_LIST_LABEL_UPDATES = 5000;
export const MAX_ORDERED_LIST_LABEL_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_ADJACENT_ORDERED_LIST_MERGE_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_LIST_GAP_TRANSACTION_STEP_TEXT_CHARS = 200_000;
export const MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS = 256;
export const MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS;
export const VISIBLE_LIST_GAP_TEXT_PATTERN = /\S/u;
