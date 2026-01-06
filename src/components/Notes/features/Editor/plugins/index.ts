// Unified plugin exports for Milkdown editor
// This file provides a single entry point for all editor plugins

// Floating Toolbar (selection-based formatting)
export { floatingToolbarPlugin, floatingToolbarKey, colorMarksPlugin } from './floating-toolbar';
export type { FloatingToolbarState, BlockType, SubMenuType } from './floating-toolbar';

// Heading (protects first H1)
export { headingPlugin } from './heading';

// Math (LaTeX)
export { mathPlugin, mathClickPlugin } from './math';

// UI plugins
export { slashPlugin } from './slash';
export { dragPlugin } from './drag';
export { tablePlugin } from './table';

// Block nodes
export { calloutPlugin } from './callout';
export { tocPlugin } from './toc';
export { mermaidPlugin } from './mermaid';
export { videoPlugin } from './video';
export { footnotePlugin } from './footnote';
export { deflistPlugin } from './deflist';

// Code
export { codePlugin, codeEnhancePlugin } from './code';

// Marks (inline formatting)
export { highlightPlugin } from './highlight';

// Decorations (visual enhancements)
export { autolinkPlugin } from './autolink';
export { abbrPlugin } from './abbr';

// Re-export types that are actually used
export type { SlashMenuItem } from './slash/types';
export type { CalloutBlockAttrs, IconData } from './callout/types';
export type { CodeBlockAttrs } from './code/types';
export type { MathBlockAttrs, MathInlineAttrs } from './math/types';
export type { MermaidAttrs } from './mermaid/types';
export type { VideoAttrs } from './video/types';
export type { TocAttrs, TocItem } from './toc/types';
export type { FootnoteDefAttrs, FootnoteRefAttrs } from './footnote/types';
