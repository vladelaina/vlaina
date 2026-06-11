import type { MarkdownDragSyntaxCase } from './notesBlockSelectionTypes';

export const MARKDOWN_DRAG_SYNTAX_CASES: MarkdownDragSyntaxCase[] = [
  {
    label: 'atx-heading',
    targetSelector: 'h2',
    targetText: 'Inline Marks And Links',
    gap: 'standard',
  },
  {
    label: 'inline-rich-paragraph',
    targetSelector: 'p',
    targetText: 'Inline marks paragraph',
    gap: 'standard',
  },
  {
    label: 'multi-line-blockquote',
    targetSelector: 'blockquote',
    targetText: 'Regular quote line one.',
    gap: 'standard',
  },
  {
    label: 'blockquote-list-item',
    targetSelector: 'blockquote li',
    targetText: 'Nested quote bullet sentinel',
    gap: 'standard',
  },
  {
    label: 'top-level-bullet',
    targetSelector: 'ul > li',
    targetText: 'Bullet item alpha',
    gap: 'list',
  },
  {
    label: 'third-level-bullet',
    targetSelector: 'li li li',
    targetText: 'Third-level bullet sentinel',
    gap: 'nested-list',
    anchorSelector: 'ul > li',
    anchorText: 'Bullet item beta',
  },
  {
    label: 'ordered-list-item',
    targetSelector: 'ol > li',
    targetText: 'Ordered item beta',
    gap: 'list',
  },
  {
    label: 'parenthesized-ordered-item',
    targetSelector: 'ol > li',
    targetText: 'Parenthesized ordered item beta',
    gap: 'list',
  },
  {
    label: 'task-list-item',
    targetSelector: 'li[data-item-type="task"]',
    targetText: 'Task item unchecked sentinel',
    gap: 'list',
  },
  {
    label: 'nested-task-list-item',
    targetSelector: 'li li[data-item-type="task"]',
    targetText: 'Nested task item sentinel',
    gap: 'nested-list',
    anchorSelector: 'li[data-item-type="task"]',
    anchorText: 'Task item checked sentinel',
  },
  {
    label: 'markdown-table',
    targetSelector: '.milkdown-table-block',
    targetText: 'Table alpha',
    gap: 'standard',
  },
  {
    label: 'fenced-code-block',
    targetSelector: '.code-block-container',
    targetText: 'syntaxSentinel',
    gap: 'standard',
  },
  {
    label: 'inline-math-paragraph',
    targetSelector: 'p',
    targetText: 'Inline math sentinel',
    gap: 'standard',
  },
  {
    label: 'math-block',
    targetSelector: 'div[data-type="math-block"]',
    targetText: 'E=mc',
    gap: 'standard',
  },
  {
    label: 'mermaid-block',
    targetSelector: 'div[data-type="mermaid"]',
    targetText: 'E2E Start',
    gap: 'standard',
  },
  {
    label: 'aligned-paragraph',
    targetSelector: 'p',
    targetText: 'Centered paragraph sentinel.',
    gap: 'standard',
  },
];
