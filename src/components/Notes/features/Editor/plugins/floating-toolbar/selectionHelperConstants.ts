import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

export const NO_COMMON_VALUE = Symbol('no-common-value');
export const RESTRICTED_SELECTION_BLOCK_TYPES = new Set(['code_block', 'frontmatter']);
export const MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS = 200_000;
export const MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES = 5_000;
