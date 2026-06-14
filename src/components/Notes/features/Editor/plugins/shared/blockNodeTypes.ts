export const LIST_CONTAINER_NODE_NAMES = new Set([
  'bullet_list',
  'ordered_list',
]);

export const COMPLEX_LIST_ITEM_CHILD_NODE_NAMES = new Set([
  'code_block',
  'image',
  'math_block',
  'mermaid',
  'table',
  'video',
  'toc',
]);

export const ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES = new Set([
  'math_block',
  'math_inline',
  'mermaid',
  'table',
  'video',
  'toc',
]);

export const NAVIGABLE_ATOMIC_BLOCK_NODE_NAMES = new Set([
  'html_block',
  'math_block',
  'mermaid',
  'video',
]);

export const TEXT_ONLY_BLOCK_EDGE_NODE_NAMES = new Set([
  'html_block',
  'math_block',
  'mermaid',
  'video',
]);

export const STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES = new Set([
  'heading',
  'blockquote',
  'callout',
  'frontmatter',
  'footnote_def',
  'hr',
  'html_block',
  'table',
  'toc',
  'video',
  'math_block',
  'mermaid',
  'code_block',
  'ordered_list',
  'bullet_list',
]);
