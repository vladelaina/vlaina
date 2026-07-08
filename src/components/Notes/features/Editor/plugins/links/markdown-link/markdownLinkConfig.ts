import { PluginKey } from '@milkdown/kit/prose/state';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../../shared/boundedProseNodeScan';

export const markdownLinkPluginKey = new PluginKey('markdown-link-paste');
export const MAX_MARKDOWN_LINK_DOC_SCAN_SIZE = 1024 * 1024;
export const MAX_MARKDOWN_LINK_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES = 5000;
export const MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS = 200_000;
export const MAX_MARKDOWN_LINK_PASTE_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_PASTE_NODES = 5000;
export const MARKDOWN_LINK_TRIGGER_TEXT_PATTERN = /[\[\]\(\)【】（）]/;

export interface MarkdownLinkPluginState {
    hasRawMarkdownLink: boolean;
}

export interface RawMarkdownLinkMatch {
    from: number;
    linkText: string;
    linkUrl: string;
    to: number;
}

export interface MarkdownLinkScanRange {
    from: number;
    to: number;
}
