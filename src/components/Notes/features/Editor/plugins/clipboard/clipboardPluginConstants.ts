import { PluginKey } from '@milkdown/kit/prose/state';

export const clipboardPluginKey = new PluginKey('editor-clipboard');
export const MAX_MARKDOWN_PASTE_CHARS = 1024 * 1024;
export const MAX_HTML_PASTE_CHARS = 2 * 1024 * 1024;
export const MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES = 5_000;
export const MAX_INLINE_FOOTNOTE_PASTE_TEXT_CHARS = 256 * 1024;
export const MAX_INLINE_FOOTNOTE_PASTE_REFERENCES = 1000;
export const MAX_INLINE_FOOTNOTE_PASTE_LABEL_CHARS = 256;
export const MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES = 5000;
export const MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS = 1000;

export const MARKDOWN_BLANK_LINE_COMMENT = '<!--vlaina-markdown-blank-line-->';
